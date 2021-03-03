'use strict';

const Homey = require('homey');

const homeyApi = require('./../../lib/homeyApi');
const _ = require('lodash');
const Flower = require('../../lib/flower');

const { Defer } = require('./../../lib/proto');

class FlowDirectorDevice extends Homey.Device {
  async onInit() {
    this.log('FlowDirectorDevice has been initialized');
    this.flowCards = {};

    this.initializeConditionsAndActions();
  }




  initializeConditionsAndActions() {
    ['flowdirector_condition__','flowdirector_action__'].forEach((cardName => {
        const cardType = cardName.startsWith('flowdirector_condition_') ? 'conditions' : 'actions';
        const actionsCards = {};
        this.flowCards[cardType] = actionsCards
        for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow[cardType].length; actionCardIndex++) {
          const actionCard = homeyApi.app.manifest.flow[cardType][actionCardIndex];
          if (!actionCard.id.startsWith('flowdirector_')) continue;
          const card = this.homey.flow[cardType =='actions' ? 'getActionCard': 'getConditionCard'](actionCard.id);
          const cardToUser = actionsCards[actionCard.id] = {
            id: actionCard.id,
            card: card,
            manifest: actionCard
          };
          card.registerRunListener(async(args, state) => {
            return Promise.reject('Flow Director cards can only be used in flows that are started by H.O.O.P.');
          });          
        }        
      }).bind(this));
  }

}

module.exports = FlowDirectorDevice;