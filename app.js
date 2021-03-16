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

  async onOAuth2Init() {
    if (process.env.DEBUG === '1')
    {
        require('inspector').open(9222, '0.0.0.0', true);
    }

    this.SETTINGS_KEY= this.SETTINGS_KEY;//+ '_' + 'HomeyOAuth';
    this.ip = (await this.homey.cloud.getLocalAddress()).split(':')[0];
    var config = {      
        client: HomeymanOAth2Client,
        apiUrl: 'http://'+this.ip+'/api',
        tokenUrl: 'https://api.athom.com/oauth2/token',
        authorizationUrl: 'https://accounts.athom.com/authorise',
        redirectUrl: 'https://cli.athom.com' || this.REDIRECT_URL,//'http://localhost',					
        //clientId : this.CLIENT_ID,//clientId,
        //clientSecret : this.CLIENT_SECRET,//clientSecret,
        scopes: [ 'homey.devices.readonly', 'homey.zones.readonly', 'homey.flow.readonly', 'homey.flow.start']//, //'account.homeys'
        //allowMultiSession: true      
    };
    this.setOAuth2Config(config);
    await super.onOAuth2Init();
    //this.clearOAuth2Clients(); //watch out!
    
    
    this.log('HOOPApp has been initialized');
    
    homeyApi.init(this);
    Flower.init(this);
    //this.log('init', await homeyApi.getDevice({id:'4fbe7935-cfe3-47d4-b552-68e05f9d0e91'}));

    this.flows = {};


    // let listener;
    // this.server = express();
    // const port = await new Promise(resolve => {
    //   listener = this.server.listen(() => {
    //     resolve(listener.address().port);
    //   });
    // });

    // this.log('------------ POORTEN ------------');
    // for (let i = 9000; i < 9001; i++) {
    //   try {
    //     let server = http.createServer((function (req, res) {
    //       //console.log('requesting: ' + req.url);
    //       //console.log('req.headers: ' + req.headers);
          
    //       // if(!req.headers || !req.headers.host || req.headers.host  != this.ip + ':47333') retur();
    
    
    //       // if (req.url.slice(0, 5) !== '/tts/') {
    //       //   return retur();
    //       // }

    //     }).bind(this)).listen(i);//, '127.0.0.1')
    //     server.close();
    //     server = null;
    //   } catch (error) {
    //     this.log(i);
    //   }
    // }

    const tokenError = await this.homey.flow.createToken('error', { type: 'string', title: 'error' })
    const tokenStackTrace = await this.homey.flow.createToken('stacktrace', { type: 'string', title: 'stacktrace' })

    //const tokenStackTrace = await this.homey.flow.createToken('stacktrace', { type: 'string', title: 'stacktrace' })
    

    // var homey = await this.getHomeyAPI();
    // this.log('homey.flow', homey.flow);

    //this.initializeTriggers();
    this.initializeConditions();
    this.initializeActions();
    this.initializeConditionsAndActions();

    
		this.homey.settings.on('set', (function(settingName) {
			if(settingName=='authorizationcode') {
				this.setAuthorizationCode();
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

  async setAuthorizationCode() {			  	  
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
				return this.getToken();
			}

			setInterval((async ()=>{
				var me = await this.client.getSessionToken();
				this.log('me', me)
			}).bind(this), 12* 60*60*1000); // elke 12 uur
      
			var token = await this.client.getSessionToken();
			this.log('me', token)

		}).call(this);
	}

	async getToken() {
		if(!this.client) await this.setAuthorization();
		return await this.client.getSessionToken();
	}




  
  
  initializeConditions() {
    var conditionsCards = {};
    this.flows.conditions = conditionsCards
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
          return { id: f.id, name: f.name }
        });
        //this.log('r',r)
        return r;
      } catch (error) { this.error('app_action__synccall.flow.registerAutocompleteListener.error :', error); throw error; }
    });
    this.flows.conditions['app_condition__await'].card.registerRunListener(({flow, actioncardsmode} = {}, state) => {
      try {
        if(!flow ) return Promise.reject('Missing flow argument');            
        var defer  = new Defer(30*1000);
        Flower.triggerFlow({flow, actioncardsmode}).then(()=> defer.resolve(true)).catch(err=>defer.reject(err));
        return defer.promise;
      } catch (error) { this.error(error) }
  });
  }

  initializeActions() {
    var actionsCards = {};
    this.flows.actions = actionsCards
    for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow.actions.length; actionCardIndex++) {
      const actionCard = homeyApi.app.manifest.flow.actions[actionCardIndex];
      if(!actionCard.id.startsWith('app_')) continue;
      var card = this.homey.flow.getActionCard(actionCard.id);
      actionsCards[actionCard.id] = {
        id: actionCard.id,
        card: card,
        manifest : actionCard
      };
      // card.registerRunListener(async (args, state) => {
      //   try {          
      //     // console.log(actionCard.id + '.registerRunListener: ');
      //     // console.log(args);
      //     // console.log(state);
      //     //var flow = await homeyApi.getFlow({ id: args.flow.id });
      //     //if (!flow.enabled) return true;

      //   } catch (error) { this.error(error) }
      // });
      // if (actionCard.args) {
      //   if (actionCard.args.find(x => x.name == 'flow' && x.type == 'autocomplete')) card.getArgument('flow').registerAutocompleteListener(async (query, args) => {
      //     //this.log(actionCard.id + '.flow.registerAutocompleteListener: ', actionCard.args);
      //     //console.log(query);
      //     //console.log(args);
      //     try {

      //       var flows = await homeyApi.getOwnTriggerFlows({args: actionCard.args, device:args.device, cardId : actionCard.id.split('__')[1] });
      //       // var flow = flows ? _.find(flows, x=>x.trigger.uri=='homey:app:nl.qluster-it.FlowEnhancer') : null;
      //       //this.log('flows', flows);
      //       //console.log(flows);
      //       if (query) flows = flows.filter(f => f.name.toLowerCase().indexOf(query.toLowerCase()) > -1);
      //       return flows.map(f => {
      //         return { id: f.id, name: f.name }
      //       });
      //     } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
      //   });
      // }    
    }
  }

  initializeConditionsAndActions() {
    ['app_condition__wait', 'app_action__wait'].forEach((card=>{ 
      this.flows[card.startsWith('app_condition') ? 'conditions' : 'actions'][card].card.registerRunListener(({waitDuration} = {}, state) => {
        try {
          if(!waitDuration ) return Promise.reject('Missing duration argument');          
          var defer  = new Defer();
          setTimeout(()=> defer.resolve(true), waitDuration);          
          return defer.promise;
        } catch (error) { this.error(error) }
      });
    }).bind(this));
    ['app_condition__throw', 'app_action__throw'].forEach((card=>{ 
      this.flows[card.startsWith('app_condition') ? 'conditions' : 'actions'][card].card.registerRunListener(({message} = {}, state) => {
        var defer = new Defer();
        if(!message ) defer.reject('Missing message argument');
        else defer.reject(message);

        return defer.promise;
      });
    }).bind(this));

    ['app_action__return'].forEach((card=>{ 
      this.flows[card.startsWith('app_condition') ? 'conditions' : 'actions'][card].card.registerRunListener( async ({} = {}, state) => {
        return true;
      });
    }).bind(this));
  }
}

module.exports = HOOPApp;