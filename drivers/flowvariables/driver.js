'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');

const homeyApi = require('./../../lib/homeyApi');
const _ = require('lodash');
const Flower = require('../../lib/flower');

const { Defer } = require('./../../lib/proto');
var safeEval = require('safe-eval')

class FlowVariablesDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('FlowVariablesDriver has been initialized');   
        Flower.init(null, this);
        homeyApi.init(this);
        this.flowCards = {};
        
        this.initializeConditions();
        this.initializeActions();
        this.initializeConditionsAndActions();
        //this.updateNames();
        this.homey.settings.on('set', (function(settingName) {
          if(settingName=='flowvariables_functions') {
            this.setFunctions();
          }
    
        }).bind(this));
        
        this.setFunctions();
    }
    async setFunctions() {			  	  
      this.functions = await this.homey.settings.get('flowvariables_functions');
      this.log('this.functions', typeof(this.functions), this.functions);
      this.context = {

      }
      if(this.functions && this.functions.length>0) for (let i = 0; i < this.functions.length; i++) {
        try {          
          const funcObj = this.functions[i];
          
          let func = funcObj.value.parseFunction();
          this.log('func', func);
          this.context[funcObj.name] = func;
        } catch (error) {
          this.log('Error creating function ' + this.functions[i].name);
          this.error(error);
        }
      }
    }
    


    async onPairListDevices(data)
    {
      const firstId = 'flowvariablesdevice';
      let devices = this.getDevices();
      if(devices && devices.length>0) devices = _.filter(devices, device=> device.getData().id==firstId);
      var id = devices && devices.length>0 ? uuidv4() : firstId;
      return {
          "name": 'Flow Variables',
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
      if(!conditionCard.id.startsWith('flowvariables_')) continue;
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
      if(!actionCard.id.startsWith('flowvariables_')) continue;
      var card = this.homey.flow.getActionCard(actionCard.id);
      actionsCards[actionCard.id] = {
        id: actionCard.id,
        card: card,
        manifest : actionCard
      };
    }
  }
  initilizeAutoCompleteName(card) {
    if(card.manifest && card.manifest.args)  {
      if (card.manifest.args.find(x => x.name == 'name' && x.type == 'autocomplete')) {
        card.card.getArgument('name').registerAutocompleteListener(async (query, args) => {
          if (!args.device) throw "Device missing";

          var list = _.filter(args.device.variables, vari=> vari.type===args.type);

          var r = [];
          if(query && query.length>0) r.push({id:query, name:query});
          var rAdd = _.map(list, vari=> {
            return {
              id:vari.name,
              name:vari.name
            }
          });
          if(query && query.length>0) rAdd = _.filter(rAdd, vari=> vari.id.toLowerCase().indexOf(query.toLowerCase())>-1);

          return _.concat(r, rAdd);
        });
        // card.card.on('update', () => {
        //   this.updateNames();
        // })
      }
    }
  }

  initializeConditionsAndActions() {
    _.each(this.flowCards.conditions, (con, key)=> {
      this.initilizeAutoCompleteName(con);
    });
        
    ['flowvariables_condition__','flowvariables_action__'].forEach((cardName => {
        const cardType = cardName.startsWith('flowvariables_condition__') ? 'conditions' : 'actions';
        // if(['flowvariables_condition__', 'flowvariables_action__'].indexOf(cardName)>-1) 
        // for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow[cardType].length; actionCardIndex++) {
        //   const actionCard = homeyApi.app.manifest.flow[cardType][actionCardIndex];
        //   if (!actionCard.id.startsWith('flowvariables_')) continue;
        //   const card = this.homey.flow[cardType =='actions' ? 'getActionCard': 'getConditionCard'](actionCard.id);          
        //   card.registerRunListener(async(args, state) => {
        //     return Promise.reject('Flow Director cards can only be used in flows that are started by H.O.O.P.');
        //   });          
        // }        
      }).bind(this));

      ['flowvariables_condition___setexpression'].forEach((cardName=>{
        var cardType = cardName.startsWith('flowvariables_condition') ? 'conditions' : 'actions';
        this.flowCards[cardType][cardName].card.registerRunListener(async (args, state) => {
          try {
              
            if(!args ) throw 'Missing args argument';
            //this.log('args, ', args);
            var result = this.runSandBox(args.expression);
            this.log('result', result);
            await args.device.setValue(args.name.id, result, args.type);
            
            return true;
          } catch (error) {
            this.log('flowvariables_condition___setexpression.registerRunListener');
            this.error(error);
          }
        });
        
      }).bind(this));
      
  }

  // updateAutoCompleteName(card) {
  //   var defer = new Defer();
  //   if(card.manifest && card.manifest.args)  {
  //     if (card.manifest.args.find(x => x.name == 'name' && x.type == 'autocomplete')) {        
  //       card.card.getArgumentValues((err, values)=> {
  //         this.log('getArgumentValues', values);
  //         if(err) return defer.reject(err);
  //         else return defer.resolve(values);
  //       });
  //     }
  //   }
  //   return defer.promise;
  // }

  // async updateNames() {
  //   var flows = await homeyApi.refreshHomeyAPI.getFlows();
  //   var devices = this.getDevices();
  //   var flat = _.flatten(flows, flow=> flow.conditions);
  //   this.log('flat', flat[0]);
  //   var conditions = _.filter(_.flatten(flows, flow=> flow.conditions), con=> _.find(devices, device=> con.uri=='homey:device:' + device.getData().id));
  //   this.log('updateNames conditions ', conditions);
  //   return;
  //   let promises = [];
  //   let values = [];
  //   _.each(this.flowCards.conditions, (con, key)=> promises.push(this.updateAutoCompleteName(con).then(x=> values.push(x))));
  //   let all = Promise.all(promises);
  //   all.then(x=> {
  //     var flattend  = _.flatten(values);
  //     this.log('flattend', flattend);
  //   }).catch();
  // }

  runSandBox(code) {
    var context = this.context;
    this.log('this.context', this.context);
    //try {
      return safeEval(code, context);
    //} catch (error) {
      
    //} 
  }


}

module.exports = FlowVariablesDriver;