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

  

  
  // async _getSession() {
  //   let sessions = null;
  //   try {
  //     sessions = this.getSavedOAuth2Sessions();
  //   } catch (err) {
  //     this.error('isAuthenticated() -> error', err.message);
  //     throw err;
  //   }
  //   if (Object.keys(sessions).length > 1) {
  //     throw new Error('Multiple OAuth2 sessions found, not allowed.');
  //   }
  //   console.log('_getSession() ->', Object.keys(sessions).length === 1 ? Object.keys(sessions)[0] : 'no session found');
  //   return Object.keys(sessions).length === 1 ? sessions : null;
  // }



};