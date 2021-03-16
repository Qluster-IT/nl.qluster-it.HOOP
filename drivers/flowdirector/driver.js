'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');

const homeyApi = require('./../../lib/homeyApi');
const _ = require('lodash');
const Flower = require('../../lib/flower');

const { Defer } = require('./../../lib/proto');    

class FlowDirectorDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('FlowDirectorDriver has been initialized');   
        Flower.init(null, this); 
        this.flowCards = {};
        
        this.initializeConditions();
        this.initializeActions();
        this.initializeConditionsAndActions();    
    }


    async onPairListDevices(data)
    {
      const firstId = 'flowdirectordevice';
      let devices = this.getDevices();
      if(devices && devices.length>0) devices = _.filter(devices, device=> device.getDate().id==firstId);
      var id = devices && devices.length>0 ? uuidv4() : firstId;
      return {
          "name": 'Flow Director',
          data:
          {
              "id": id
          }
      };
    }

    
  initializeConditions() {
    var conditionsCards = {};
    this.flowCards.conditions = conditionsCards
    for (let cardIndex = 0; cardIndex < homeyApi.app.manifest.flow.conditions.length; cardIndex++) {
      const conditionCard = homeyApi.app.manifest.flow.conditions[cardIndex];
      if(!conditionCard.id.startsWith('flowdirector_')) continue;
      var card = this.homey.flow.getConditionCard(conditionCard.id);
      conditionsCards[conditionCard.id] = {
        id: conditionCard.id,
        card: card,
        manifest : conditionCard
      };
    }
  }
  
  initializeActions() {
    var actionsCards = {};
    this.flowCards.actions = actionsCards
    for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow.actions.length; actionCardIndex++) {
      const actionCard = homeyApi.app.manifest.flow.actions[actionCardIndex];
      if(!actionCard.id.startsWith('flowdirector_')) continue;
      var card = this.homey.flow.getActionCard(actionCard.id);
      actionsCards[actionCard.id] = {
        id: actionCard.id,
        card: card,
        manifest : actionCard
      };
    }
  }

  initializeConditionsAndActions() {
    ['flowdirector_condition__','flowdirector_action__'].forEach((cardName => {
        const cardType = cardName.startsWith('flowdirector_condition_') ? 'conditions' : 'actions';
        if(['flowdirector_condition___', 'flowdirector_action___'].indexOf(cardName)>-1) 
          for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow[cardType].length; actionCardIndex++) {
            const actionCard = homeyApi.app.manifest.flow[cardType][actionCardIndex];
            if (!actionCard.id.startsWith('flowdirector_')) continue;
            const card = this.homey.flow[cardType =='actions' ? 'getActionCard': 'getConditionCard'](actionCard.id);          
            card.registerRunListener(async(args, state) => {
              return Promise.reject('Flow Director cards can only be used in flows that are started by H.O.O.P.');
            });          
          }        
      }).bind(this));
      ['flowdirector_condition__throw', 'flowdirector_action__throw'].forEach((cardName=>{ 
        this.flowCards[cardName.startsWith('flowdirector_condition') ? 'conditions' : 'actions'][cardName].card.registerRunListener(({message} = {}, state) => {
          var defer = new Defer();
          if(!message ) defer.reject('Missing message argument');
          else defer.reject(message);
  
          return defer.promise;
        });
      }).bind(this));
  }


}

module.exports = FlowDirectorDriver;