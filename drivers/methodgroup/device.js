'use strict';

const Homey = require('homey');

const homeyApi = require('./../../lib/homeyApi');
const _ = require('lodash');
const Flower = require('../../lib/flower');

const { Defer } = require('./../../lib/proto');

class MethodGroupDevice extends Homey.Device {
  async onInit() {
    this.log('MyApp has been initialized');


  }





}

module.exports = MethodGroupDevice;