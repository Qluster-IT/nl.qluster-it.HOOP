'use strict';

const Homey = require('homey');
const homeyApi = require('./lib/homeyApi');
const _ = require('lodash');


class FlowEnhancerApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('FlowEnhancerApp has been initialized');
    homeyApi.init(this);
    //this.log('init', await homeyApi.getDevice({id:'4fbe7935-cfe3-47d4-b552-68e05f9d0e91'}));
  }

}

module.exports = FlowEnhancerApp;