'use strict';

const Homey = require('homey');


class FlowVariablesDevice extends Homey.Device {
  async onInit() {
    this.log('FlowVariablesDevice has been initialized');
  }
}

module.exports = FlowVariablesDevice;