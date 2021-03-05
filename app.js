'use strict';

const Homey = require('homey');
const homeyApi = require('./lib/homeyApi');
const _ = require('lodash');
const { Defer } = require('./lib/proto');
const Script = require('./lib/script');
const Flower = require('./lib/flower');

//const { HomeyAPI } = require('athom-api');

class HOOPApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() { 
    this.log('HOOPApp has been initialized');
    homeyApi.init(this);
    Script.init(this);
    Flower.init(this);
    //this.log('init', await homeyApi.getDevice({id:'4fbe7935-cfe3-47d4-b552-68e05f9d0e91'}));

    this.flows = {};

    
    const tokenError = await this.homey.flow.createToken('error', { type: 'string', title: 'error' })
    const tokenStackTrace = await this.homey.flow.createToken('stacktrace', { type: 'string', title: 'stacktrace' })

    //const tokenStackTrace = await this.homey.flow.createToken('stacktrace', { type: 'string', title: 'stacktrace' })
    

    // var homey = await this.getHomeyAPI();
    // this.log('homey.flow', homey.flow);

    //this.initializeTriggers();
    this.initializeConditions();
    this.initializeActions();
    this.initializeConditionsAndActions();
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