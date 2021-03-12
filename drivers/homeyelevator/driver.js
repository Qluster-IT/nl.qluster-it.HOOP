"use strict";
//var util = require('../../lib/util/util.js');
//var variableManager = require('../../lib/variablemanagement/variablemanagement.js');

const { OAuth2Driver, OAuth2Util, OAuth2Client } = require('homey-oauth2app');

const OAuth2Controller = require('./../../lib/outh2Clients/OAuth2Controller');
const HomeymanOAth2Client = require('../../lib/outh2Clients/HomeyOAuth2Client');
var devices = [];

module.exports = class HomeyDriver extends OAuth2Driver { //Homey.Driver {
	/** @type {OAuth2Controller} */
	// static get homeyOAuth(){ return this._homeyOAuth;}
	// static set homeyOAuth(value){ this._homeyOAuth = value;}

	/** @type {HomeymanOAth2Client} */
	static get client(){ return this._homeyOAuthClient;}
	static set client(value){ this._homeyOAuthClient = value;}

	onOAuth2Init() {
		console.log('HomeyDriver onOAuth2Init');
		
		
		this.homey.cloud.getHomeyId().then(cloudId=>{
			this.homeyId = cloudId;
		});
		

		
		// this.homey.settings.on('set', (function(settingName) {
		// 	if(settingName=='authorizationcode') {
		// 		this.setAuthorizationCode();
		// 	}

		//   }).bind(this));
		//   //await this.setCloudJSON();
		//   this.setAuthorization();
	  }
	//   async setAuthorizationCode() {			  	  
	// 	var code = await this.homey.settings.get('authorizationcode');
	// 	this.setAuthorization(code);
	//   }
	// async setAuthorization(code) {	
	// 	// var clientId = await this.homey.settings.get('clientid');
	// 	// var clientSecret = await this.homey.settings.get('clientsecret');

	// 	this.ip = (await this.homey.cloud.getLocalAddress()).split(':')[0];
	// 	this.log('setAuthorizationCode ', code);
	// 	(async ()=>{
	// 		this.log('ASYNC STARTS');
			
	// 		// this.homeyOAuthController = new OAuth2Controller({
	// 		// 	name: "HomeyOAuth", config: {
	// 		// 		client: HomeymanOAth2Client,
	// 		// 		apiUrl: 'http://'+this.ip+'/api',
	// 		// 		tokenUrl: 'https://api.athom.com/oauth2/token',
	// 		// 		authorizationUrl: 'https://accounts.athom.com/authorise',
	// 		// 		redirectUrl: 'http://localhost',					
	// 		// 		clientId : clientId,
	// 		// 		clientSecret : clientSecret,
	// 		// 		scopes: ['homey.devices.readonly', 'homey.zones.readonly', 'homey.flow.readonly', 'homey.flow.start']//, //'account.homeys'
	// 		// 		//allowMultiSession: true
	// 		// 	}, homey : this.homey
	// 		// });
	// 		//this.homeyOAuthController.deleteOAuth2Client({sessionId:"735d5f4b-150a-4d39-ad12-65b3b65e79f6", configId:"default"});
	// 		this.homeyOAuthClient = await this.getClient(code); //code
	// 		this.flow = this.devices = this.homeyOAuthClient;
	// 		this.homeyOAuthClient.refresh = async ()=> {
	// 			return this.getToken();
	// 		}
	// 		var token = await this.homeyOAuthClient.getSessionToken();
	// 		this.log('me', token)

	// 		setInterval((async ()=>{
	// 			var me = await this.homeyOAuthClient.getSessionToken();
	// 			this.log('me', me)
	// 		}).bind(this), 12* 60*60*1000); // elke 12 uur
	// 	}).call(this);
	// }

	// async getToken() {
	// 	if(!this.homeyOAuthClient) await this.setAuthorization();
	// 	return await this.homeyOAuthClient.getSessionToken();
	// }

	// async onPairListDevices({ oAuth2Client }) {
	// 	console.log('onPairListDevices');
	// 	const me = await oAuth2Client.getMe();
	// 	console.log('me');
	// 	console.log(me);
	// 	return me.map(thing => {
	// 	  return {
	// 		name: thing.name,
	// 		data: {
	// 		  id: thing.id,
	// 		},
	// 	  }
	// 	});
	// }

	async onPair(session) {
		// Show a specific view by ID
		// await session.showView('my_view');
	
		// // Show the next view
		// await session.nextView();
	
		// // Show the previous view
		// await session.prevView();
	
		// // Close the pair session
		// await session.done();
	
		// Received when a view has changed
		session.setHandler('showView', async (viewId)=> {
		  console.log('View: ' + viewId);
		});
		session.setHandler('authorizationcode', async (code) =>{
			console.log('autorizationcode: ' + code);
			this.homey.settings.set('authorizationcode', code);
		  });
	  }


  }




