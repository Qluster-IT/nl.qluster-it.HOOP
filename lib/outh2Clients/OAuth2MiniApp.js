'use strict';

const Homey = require('homey');

const _ = require('lodash');
const { OAuth2Token, OAuth2Error } = require('homey-oauth2app');

const SETTINGS_KEY = 'OAuth2MiniSessions';

const sDebug = Symbol('debug');
const sConfigs = Symbol('configs');
const sClients = Symbol('clients');

const OAuth2ClientMini = require('./OAuth2ClientMini');

const { OAuth2Util } = require('homey-oauth2app');

module.exports = class OAuth2MiniApp extends Homey.App {

  onInit() {
    //onInit(homey) {
      //this.homey = homey;
    this[sDebug] = false;
    this[sConfigs] = {};
    this[sClients] = {};

    return this.onOAuth2Init();
  }

  
  clearOAuth2Clients() {
    var sessions = this.getSavedOAuth2Sessions();
    
    _(sessions).forEach((ses,key)=>{
      this.deleteOAuth2Client({sessionId:key, configId:ses.configId});
    });

  }

  async getClient(code) {

    // Try get first saved client
    let client;
    try {
      //dont get saved...
      client = this.getFirstSavedOAuth2Client();
    } catch (err) {
      console.log('login() -> no existing OAuth2 client available');
      console.log(JSON.stringify(err));
    }
    //console.log(client);
    if(client && client.getTokenByCode) return client;
    // if(client instanceof Error) this.error('client is Error');
    // else if(client) {
      
    //   return client;
    // }

    // Create new client since first saved was not found
    if (!client || client instanceof Error || !client.getTokenByCode) {
      client = this.createOAuth2Client({ sessionId: OAuth2Util.getRandomId() });
    }

    console.log('login() -> created new temporary OAuth2 client');
    console.log('login() -> receiving OAuth2 code');
    console.log(code);
    try {
      await client.getTokenByCode({ code });
    } catch (err) {
      this.log('login() -> could not get token by code');
      this.error(err);      
    }
    
    console.log('login() -> received OAuth2 code');
    // get the client's session info
    const session = await client.onGetOAuth2SessionInformation();
    const token = client.getToken();
    const { title } = session;
    client.destroy();

    try {
      // replace the temporary client by the final one and save it
      client = this.createOAuth2Client({ sessionId: session.id });
      client.setTitle({ title });
      client.setToken({ token });
      client.save();
      
      //this.setStoreValue('OAuth2SessionId', sessionId);
      //this.setStoreValue('OAuth2ConfigId', configId);

    } catch (err) {
      this.error('Could not create new OAuth2 client', err);
    }

    console.log('login() -> authenticated');
    this.homey.api.realtime('authorized');
    return client;

  }




  onOAuth2Init() {
    // Extend me
    
  }

  enableOAuth2Debug() {
    this[sDebug] = true;
  }

  disableOAuth2Debug() {
    this[sDebug] = false;
  }

  /*
   * Set the app's config.
   * Most apps will only use one config, `default`.
   * All methods default to this config.
   * For apps using multiple clients, a configId can be provided.
   */
  setOAuth2Config({
    configId = 'default',
    token = OAuth2Token,
    grantType = 'authorization_code',
    client = OAuth2ClientMini,
    clientId = this.CLIENT_ID || Homey.env.CLIENT_ID,
    clientSecret = this.CLIENT_SECRET || Homey.env.CLIENT_SECRET ,
    apiUrl,
    tokenUrl,
    authorizationUrl,
    redirectUrl = this.REDIRECT_URL || 'https://callback.athom.com/oauth2/callback',
    scopes = [],
    allowMultiSession = false,
  }) {
    if (typeof configId !== 'string') {
      throw new OAuth2Error('Invalid Config ID');
    }

    if (this.hasConfig(configId)) {
      throw new OAuth2Error('Duplicate Config ID');
    }

    if (!client
     || (client !== OAuth2ClientMini && (client.prototype instanceof OAuth2ClientMini) !== true)) {
      throw new OAuth2Error('Invalid Client, must extend OAuth2ClientMini');
    }

    if (!token
     || (token !== OAuth2Token && (token.prototype instanceof OAuth2Token) !== true)) {
      throw new OAuth2Error('Invalid Token, must extend OAuth2Token');
    }

    if (typeof clientId !== 'string') {
      throw new OAuth2Error('Invalid Client ID');
    }

    if (typeof clientSecret !== 'string') {
      throw new OAuth2Error('Invalid Client Secret');
    }

    if (typeof apiUrl !== 'string') {
      throw new OAuth2Error('Invalid API URL');
    }

    if (typeof tokenUrl !== 'string') {
      throw new OAuth2Error('Invalid Token URL');
    }

    if (typeof authorizationUrl !== 'undefined' && typeof authorizationUrl !== 'string') {
      throw new OAuth2Error('Invalid Authorization URL');
    }

    if (typeof redirectUrl !== 'string') {
      throw new OAuth2Error('Invalid Redirect URL');
    }

    if (typeof grantType !== 'string') {
      throw new OAuth2Error('Invalid Redirect URL');
    }

    if (!Array.isArray(scopes)) {
      throw new OAuth2Error('Invalid Scopes Array');
    }

    if (typeof allowMultiSession !== 'boolean') {
      throw new OAuth2Error('Invalid Allow Multi Session');
    }

    if (allowMultiSession === true && (!Homey.version || Homey.version.charAt(0) === '1')) {
      throw new OAuth2Error('Multi Session is unsupported on Homey v1.x');
    }

    this[sConfigs][configId] = {
      token,
      grantType,
      client,
      clientId,
      clientSecret,
      apiUrl,
      tokenUrl,
      authorizationUrl,
      redirectUrl,
      scopes,
      allowMultiSession,
    };
    this[sClients][configId] = {};
  }


  /*
   * OAuth2 Config Management
   */
  hasConfig({
    configId = 'default',
  } = {}) {
    return !!this[sConfigs][configId];
  }

  checkHasConfig({
    configId = 'default',
  } = {}) {
    const hasConfig = this.hasConfig({ configId });
    if (!hasConfig) {
      throw new OAuth2Error('Invalid OAuth2 custom Config');
    }
  }

  getConfig({
    configId = 'default',
  } = {}) {
    this.checkHasConfig({ configId });
    return this[sConfigs][configId];
  }

  /*
   * OAuth2 Client Management
   */
  hasOAuth2Client({
    sessionId,
    configId = 'default',
  } = {}) {
    this.checkHasConfig({ configId });
    return !!this[sClients][configId][sessionId];
  }

  checkHasOAuth2Client({
    sessionId,
    configId = 'default',
  } = {}) {
    const hasClient = this.hasOAuth2Client({ configId, sessionId });
    if (!hasClient) {
      throw new OAuth2Error('Invalid OAuth2 custom Client');
    }
  }

  createOAuth2Client({
    sessionId,
    configId = 'default',
  } = {}) {
    if (this.hasOAuth2Client({ configId, sessionId })) {
      throw new OAuth2Error('OAuth2 Client already exists');
    }

    const {
      token,
      client,
      clientId,
      clientSecret,
      apiUrl,
      tokenUrl,
      authorizationUrl,
      redirectUrl,
      scopes,
    } = this.getConfig({ configId });

    // eslint-disable-next-line new-cap
    const clientInstance = new client({
      homey:this.homey,
      token,
      clientId,
      clientSecret,
      apiUrl,
      tokenUrl,
      authorizationUrl,
      redirectUrl,
      scopes,
    });
    this[sClients][configId][sessionId] = clientInstance;
    clientInstance.on('log', (...args) => this.log(`[${client.name}] [c:${configId}] [s:${sessionId}]`, ...args));
    clientInstance.on('error', (...args) => this.error(`[${client.name}] [c:${configId}] [s:${sessionId}]`, ...args));
    clientInstance.on('debug', (...args) => this[sDebug] && this.log(`[dbg] [${client.name}] [c:${configId}] [s:${sessionId}]`, ...args));
    clientInstance.on('save', () => this.saveOAuth2Client({ client: clientInstance, configId, sessionId }));
    clientInstance.on('destroy', () => this.deleteOAuth2Client({ configId, sessionId }));
    clientInstance.init();
    return clientInstance;
  }

  deleteOAuth2Client({
    sessionId,
    configId = 'default',
  } = {}) {
    // remove from storage
    const savedSessions = this.getSavedOAuth2Sessions();
    delete savedSessions[sessionId];
    this.homey.settings.set(SETTINGS_KEY, savedSessions);
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! deleteOAuth2Client: ' + sessionId);
    console.log(JSON.stringify(savedSessions));
    // remove from memory
    delete this[sClients][configId][sessionId];
  }

  getOAuth2Client({
    sessionId,
    configId = 'default',
  } = {}) {
    // if the client for this session has already been initialized, return that
    if (this.hasOAuth2Client({ configId, sessionId })) {
      return this[sClients][configId][sessionId];
    }

    // create a client from storage if available
    const savedSessions = this.getSavedOAuth2Sessions();
    if (savedSessions && savedSessions[sessionId]) {
      const {
        token,
        title,
      } = savedSessions[sessionId];

      const {
        token: Token,
      } = this.getConfig();

      const client = this.createOAuth2Client({
        sessionId,
        configId,
      });
      client.setToken({ token: new Token(token) });
      client.setTitle({ title });

    //   this.tryCleanSession({
    //     sessionId,
    //     configId,
    //   });

      return client;
    }

    throw new OAuth2Error('Could not get OAuth2Client');
  }

  saveOAuth2Client({ configId, sessionId, client }) {
    const token = client.getToken();
    const title = client.getTitle();
    this.clearOAuth2Clients();

    const savedSessions = this.getSavedOAuth2Sessions();
    savedSessions[sessionId] = {
      configId,
      title,
      token,
    };
    this.homey.settings.set(SETTINGS_KEY, savedSessions);
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! saveOAuth2Client: ' + SETTINGS_KEY);
    console.log(JSON.stringify(savedSessions));
  }

  getSavedOAuth2Sessions() {
    return this.homey.settings.get(SETTINGS_KEY) || {};
  }

  getFirstSavedOAuth2Client() {
    var sessions = this.getSavedOAuth2Sessions();
    
    _(sessions).forEach((ses,key)=>{

      if(!ses.token) delete sessions[key];
    });
    
    if (Object.keys(sessions).length < 1) {
      throw new OAuth2Error('No OAuth2 Client Found');
    }
    
    const [sessionId] = Object.keys(sessions);
    const { configId } = sessions[sessionId];
    
    console.log('getFirstSavedOAuth2Client');//getFirstSavedOAuth2Client
    console.log(sessionId);
    console.log(configId);
    return this.getOAuth2Client({
      configId,
      sessionId,
    });
  }

  tryCleanSession({
    sessionId,
    configId = 'default',
  }) {
    this.onShouldDeleteSession({ sessionId }).then(shouldDeleteSession => {
      if (shouldDeleteSession) {
        this.deleteOAuth2Client({
          sessionId,
          configId,
        });
      }
    }).catch(this.error);
  }

  async onShouldDeleteSession({
    sessionId,
    configId = 'default',
  }) {
    let foundSession = false;

    await Promise.all(Object.values(this.homey.drivers.getDrivers()).map(async driver => {
      await new Promise(resolve => {
        driver.ready(resolve);
      });

      const devices = driver.getDevices();
      await Promise.all(devices.map(async device => {
        await new Promise(resolve => {
          device.ready(resolve);
        });

        const {
          OAuth2ConfigId,
          OAuth2SessionId,
        } = device.getStore();

        if (OAuth2SessionId === sessionId
         && OAuth2ConfigId === configId) foundSession = true;
      }));
    }));

    return !foundSession;
  }

};
