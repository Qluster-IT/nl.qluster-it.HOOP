'use strict';
const http = require('http');

const Homey = require('homey');
const homeyApi = require('./lib/homeyApi');
const _ = require('lodash');
const { Defer } = require('./lib/proto');
const Flower = require('./lib/flower');
const OAuth2Controller = require('./lib/outh2Clients/OAuth2Controller');

const  HomeymanOAth2Client = require('./lib/outh2Clients/HomeyOAuth2Client');
const OAuth2MiniApp = require('./lib/outh2Clients/OAuth2MiniApp');

class HOOPApp extends OAuth2MiniApp {//OAuth2MiniApp {// Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  SETTINGS_KEY = 'OAuth2Sessions';
  static OAUTH2_CLIENT = HomeymanOAth2Client;
  static OAUTH2_DEBUG = true;
  
  // async onInit() { 

  //   //this.homey.settings.set('clientid', Homey.env.CLIENT_ID)
  //   //this.homey.settings.set('clientid', Homey.env.CLIENT_ID)
  //   this.homey.settings.set('homeyid', (await this.homey.cloud.getHomeyId()));

  async initConfig() {
    let client_id = this.homey.settings.get('clientid');
    let client_secret = this.homey.settings.get('clientsecret');
    if(client_id=='') client_id = null;
    if(client_secret=='') client_secret = null;
    this.CLIENT_ID = client_id;
    this.CLIENT_SECRET = client_secret;
    
    let redirect_url = null;
    if(client_id && client_id.length>0 && client_secret && client_secret.length>0 ) {
      redirect_url = 'http://localhost';
    }
    var config = {      
      client: HomeymanOAth2Client,
      apiUrl: 'http://'+this.ip+'/api',
      tokenUrl: 'https://api.athom.com/oauth2/token',
      authorizationUrl: 'https://accounts.athom.com/authorise',
      redirectUrl: redirect_url || 'https://cli.athom.com',//'http://localhost',					
      // clientId : client_id,//clientId,
      // clientSecret : client_secret,//clientSecret,
      scopes: [ 'homey.devices.readonly', 'homey.zones.readonly', 'homey.flow.readonly', 'homey.flow.start']//, //'account.homeys'
      //allowMultiSession: true      
    };
    
    try {     
      this.setOAuth2Config(config);
      await super.onOAuth2Init(); 
    } catch (error) {
     this.log('initConfig.error'); 
     this.error(error);
    }
  }

  async onOAuth2Init() {
    if (process.env.DEBUG === '1') require('inspector').open(9222, '0.0.0.0', true);

    this.SETTINGS_KEY= this.SETTINGS_KEY;//+ '_' + 'HomeyOAuth';
    this.ip = (await this.homey.cloud.getLocalAddress()).split(':')[0];

    //this.clearOAuth2Clients(); //watch out!
    await this.initConfig();
    
    this.log('HOOPApp has been initialized');
    
    homeyApi.init(this);
    Flower.init(this);
    //this.log('init', await homeyApi.getDevice({id:'4fbe7935-cfe3-47d4-b552-68e05f9d0e91'}));

    this.flows = {};



    const tokenError = await this.homey.flow.createToken('error', { type: 'string', title: 'error' });
    const tokenStackTrace = await this.homey.flow.createToken('stacktrace', { type: 'string', title: 'stacktrace' });

    //const tokenStackTrace = await this.homey.flow.createToken('stacktrace', { type: 'string', title: 'stacktrace' })
    

    // var homey = await this.getHomeyAPI();
    // this.log('homey.flow', homey.flow);

    //this.initializeTriggers();
    this.initializeConditions();
    this.initializeActions();
    this.initializeConditionsAndActions();

    
		this.homey.settings.on('set', (function(settingName) {
			if(settingName=='authorizationcode') {        
        this.setAuthorizationCode({reset:true});
			} else if(settingName=='cleartoken') {
				this.clearToken();
			}

		  }).bind(this));
		  //await this.setCloudJSON();
		  this.setAuthorization();
  }


  async clearToken() {			  	  
    this.log('clearing token');
    
    this.clearOAuth2Clients(); //watch out!

  }

  async setAuthorizationCode({reset}) {
    if(reset) {
      this.clearToken();
      await this.initConfig();
    }
				
		var code = await this.homey.settings.get('authorizationcode');
		this.setAuthorization(code);
  }
	async setAuthorization(code) {	
    
    // var clientId = await this.homey.settings.get('clientid');
		// var clientSecret = await this.homey.settings.get('clientsecret');

		this.ip = (await this.homey.cloud.getLocalAddress()).split(':')[0];
    
    this.log('setAuthorizationCode ', code);
		(async ()=>{
			this.log('ASYNC STARTS');
			
			// this.homeyOAuthController = new OAuth2Controller({
			// 	name: "HomeyOAuth", config: {
			// 		client: HomeymanOAth2Client,
			// 		apiUrl: 'http://'+this.ip+'/api',
			// 		tokenUrl: 'https://api.athom.com/oauth2/token',
			// 		authorizationUrl: 'https://accounts.athom.com/authorise',
			// 		redirectUrl: 'http://localhost',					
			// 		clientId : clientId,
			// 		clientSecret : clientSecret,
			// 		scopes: ['homey.devices.readonly', 'homey.zones.readonly', 'homey.flow.readonly', 'homey.flow.start']//, //'account.homeys'
			// 		//allowMultiSession: true
			// 	}, homey : this.homey
			// });
			//this.homeyOAuthController.deleteOAuth2Client({sessionId:"735d5f4b-150a-4d39-ad12-65b3b65e79f6", configId:"default"});
      if(this.client && this.client.refresh) this.client.refresh();

			this.client = await this.getClient(code); //code
      this.homey.drivers.getDriver('homeyelevator').client = this.client;
      
			//this.refreshOwnFlows();
			this.client.refresh = async ()=> {
				return await this.getToken();
			};

			setInterval((async ()=>{
				var me = await this.client.getSessionToken();
				this.log('me', me);
			}).bind(this), 1* 60*60*1000); // elke 1 uur
      
			var token = await this.client.getSessionToken();
			this.log('me', token);

		}).call(this);
	}

	async getToken() {
		if(!this.client) await this.setAuthorization();
		return await this.client.getSessionToken();
	}




  
  
  initializeConditions() {
    var conditionsCards = {};
    this.flows.conditions = conditionsCards;
    for (let cardIndex = 0; cardIndex < homeyApi.app.manifest.flow.conditions.length; cardIndex++) {
      const conditionCard = homeyApi.app.manifest.flow.conditions[cardIndex];
      if(!conditionCard.id.startsWith('app_')) continue;
      var card = this.homey.flow.getConditionCard(conditionCard.id);
      conditionsCards[conditionCard.id] = {
        id: conditionCard.id,
        card: card,
        manifest : conditionCard
      };
    }    
    this.flows.conditions['app_condition__await'].card.getArgument('flow').registerAutocompleteListener(async (query, args) => {
      try {
        var flows = await homeyApi.getFlows();
        _.filter(flows, f => //f.enabled && 
          this.triggerAble);

        if (query) flows = _.filter(flows, f => f.name.toLowerCase().indexOf(query.toLowerCase()) > -1);
        flows = _.orderBy(flows, f=>f.name);
        var r = _.map(flows,f => {
          return { id: f.id, name: f.name };
        });
        //this.log('r',r)
        return r;
      } catch (error) { this.error('app_action__synccall.flow.registerAutocompleteListener.error :', error); throw error; }
    });
    this.flows.conditions['app_condition__await'].card.registerRunListener(({flow, actioncardsmode} = {}, state={}) => {
      try {
        if(!flow ) return Promise.reject('Missing flow argument');            
        var defer  = new Defer(30*1000);
        Flower.triggerFlow({flow, actioncardsmode}).then(()=> defer.resolve(true)).catch(err=>defer.reject(err));
        return defer.promise;
      } catch (error) { this.error(error); }
  });
  }

  initializeActions() {
    var actionsCards = {};
    this.flows.actions = actionsCards;
    for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow.actions.length; actionCardIndex++) {
      const actionCard = homeyApi.app.manifest.flow.actions[actionCardIndex];
      if(!actionCard.id.startsWith('app_')) continue;
      var card = this.homey.flow.getActionCard(actionCard.id);
      actionsCards[actionCard.id] = {
        id: actionCard.id,
        card: card,
        manifest : actionCard
      };
    }
  }

  initializeConditionsAndActions() {
    ['app_condition__wait', 'app_action__wait'].forEach((card=>{ 
      this.flows[card.startsWith('app_condition') ? 'conditions' : 'actions'][card].card.registerRunListener(({waitDuration} = {}, state={}) => {
        try {
          if(!waitDuration ) return Promise.reject('Missing duration argument');          
          var defer  = new Defer();
          setTimeout(()=> defer.resolve(true), waitDuration);          
          return defer.promise;
        } catch (error) { this.error(error); }
      });
    }).bind(this));
    ['app_condition__throw', 'app_action__throw'].forEach((card=>{ 
      this.flows[card.startsWith('app_condition') ? 'conditions' : 'actions'][card].card.registerRunListener(({message} = {}, state={}) => {
        var defer = new Defer();
        if(!message ) defer.reject('Missing message argument');
        else defer.reject(message);

        return defer.promise;
      });
    }).bind(this));

    ['app_action__return'].forEach((card=>{ 
      this.flows[card.startsWith('app_condition') ? 'conditions' : 'actions'][card].card.registerRunListener( async (args, state={}) => {
        return true;
      });
    }).bind(this));
  }
}

module.exports = HOOPApp;