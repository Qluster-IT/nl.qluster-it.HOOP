'use strict';

const Homey = require('homey');

const _ = require('lodash');

class FlowVariablesDevice extends Homey.Device {
  async onInit() {
    this.log('FlowVariablesDevice has been initialized');
    this.log('this.id', this.getData().id);
    this.variables = this.homey.settings.get(this.getData().id + '_variables');
    if(!this.variables) this.variables = {};
    _.each(this.variables, async(vari)=> vari.token = await this.createToken(vari.name, vari.value, vari.token.opts.type));
  }

  async setValue(name, value, type) {
    let baseType = type;
    switch (type) {
      case 'string':
        if(!_.isString(value) && value!==null && value!==undefined) value = value.toString(); else value = _.isString(value) ? value :'';
        break;
      case 'number':
        if(!_.isNumber(value) && value!==null && value!==undefined) value = Number.parseFloat(value.toString()); else value = _.isNumber(value) ? value : -1;
        break;
      case 'boolean':
        if(!_.isBoolean(value) && value!==null && value!==undefined) value = (value.toString() === 'true' || value.toString() ==='1'); else value = _.isBoolean(value) ? value :false;
        break;
      case 'json':
        value = JSON.stringify(value);
        type='string';
        break;
      default:
        if(!_.isString(value) && value.toString) value = value.toString(); else value = '';
        type='string';
        break;
    }
    //var type = _.isString(value) ? 'string' : _.isNumber(value) ? 'number' : _.isBoolean('boolean');
    if(!type) throw "Wrong variable type.";
    var token = null;
    if(Object.keys(this.variables).indexOf(name)>-1) {
      token = this.variables[name].token;
      //exists check type and notify if changed.
      //if changed only!!!!
      // if(this.variables[name].token && this.variables[name].token.unregister) {
      //   this.variables[name].token.unregister();
      //   this.variables[name].token = true;
      // }
    }
    if(token)this.log('token.opts ', token.opts);
    if(!token || token.opts.type!=type) {
      if(token && token.unregister) token.unregister();
      token = await this.createToken(name, value, type);      
    }
    this.variables[name] = {
      name,
      value,
      token,
      type:baseType
    }
    this.homey.settings.set(this.getData().id + '_variables', this.variables);
    await token.setValue(value);
  }
  async createToken(name, value, type) {
    let data = this.getData();
    let deviceName =this.getName();

    this.log('createToken ', data.id + '_' + name, ' of type', type);
    this.log('data', data)
    this.log('this.name', this.name)
    this.log('this.getName()', this.getName());
    const token = await this.homey.flow.createToken(data.id + '_' + name, {
      type,
      title: deviceName + ' - ' + name
    })
    return token;
  }
}

module.exports = FlowVariablesDevice;