'use strict';

const Homey = require('homey');


class FlowDirectorDevice extends Homey.Device {
  async onInit() {
    this.log('FlowDirectorDevice has been initialized');
  }



}

module.exports = FlowDirectorDevice;