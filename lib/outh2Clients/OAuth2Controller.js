'use strict';

const Homey = require('homey');
const { OAuth2Util } = require('homey-oauth2app');
const OAuth2MiniApp = require('./OAuth2MiniApp');

//const Global = require('./../global');
const Homeyman = require('../../app');
//const l = Global.l;

module.exports = class OAuth2Controller extends OAuth2MiniApp {

  //driverName;
  // Overload what needs to be overloaded here
  SETTINGS_KEY = 'OAuth2Sessions';

  constructor({ name, config, homey }) {
    //Global.l
    super();
    super.onInit(homey);
    this.SETTINGS_KEY= this.SETTINGS_KEY+ '_' + name;
    // this[sConfigs] = {};
    // this[sClients] = {};
    this.setOAuth2Config(config);
    console.log('constructor');
    
    //this.clearOAuth2Clients();
    
    //this.client = this.getClient('');
    // this.login('dd0ca04a0eebdbae9c3dfb477627a2b003e9c7ce').then((client)=>{
    //   this.log('login');
    //   this.log(client);
    //   //this.log(client());
    // }) ;
  }

  error(s, ex) {
    console.error(s);
    console.error(JSON.stringify(ex));
    
  }
  log(s) {
    console.log(s);
  }
  debug(s) {
    console.debug(s);
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

    // Get Toon devices and call resetOAuth2Client on device to re-bind a new OAuth2Client
    // instance to the device
    // try {
    //   await this.HomeyDriver
    //     .getDevices()
    //     .forEach(toonDevice => toonDevice.resetOAuth2Client({
    //       sessionId: session.id,
    //       configId: this.HomeyDriver.getOAuth2ConfigId(),
    //     }));
    // } catch (err) {
    //   this.error('Could not reset OAuth2 client on Toon device instance', err);
    //   this.homey.api.realtime('error', new Error(Homey.__('authentication.re-login_failed_with_error', { error: err.message || err.toString() })));
    // }
    //console.log('login() -> reset devices to new OAuth2 client');
    // // Start OAuth2 process
    // return new Homey.CloudOAuth2Callback(client.getAuthorizationUrl())
    //   .on('url', url => this.homey.api.realtime('url', url))
    //   .on('code', async code => {

    //   })
    //   .generate();
  }

  // async logout() {
  //   console.log('logout()');
  //   const session = await this._getSession();
  //   const sessionId = Object.keys(session)[0];
  //   this.deleteOAuth2Client({ sessionId, configId: session.configId });

  //   // Get Toon devices and mark as unavailable
  //   // return Promise.all(
  //   //   this.HomeyDriver
  //   //     .getDevices()
  //   //     .map(toonDevice => toonDevice.setUnavailable(Homey.__('authentication.re-authorize'))),
  //   // );
  // }

  async _getSession() {
    let sessions = null;
    try {
      sessions = this.getSavedOAuth2Sessions();
    } catch (err) {
      this.error('isAuthenticated() -> error', err.message);
      throw err;
    }
    if (Object.keys(sessions).length > 1) {
      throw new Error('Multiple OAuth2 sessions found, not allowed.');
    }
    console.log('_getSession() ->', Object.keys(sessions).length === 1 ? Object.keys(sessions)[0] : 'no session found');
    return Object.keys(sessions).length === 1 ? sessions : null;
  }



};