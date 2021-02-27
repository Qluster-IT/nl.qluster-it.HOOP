'use strict';

const Homey = require('homey');

const homeyApi = require('./../../lib/homeyApi');
const _ = require('lodash');

const defaults = {
    text:'null',
    number:-1,
    bool:false
  }

class FlowGroupDevice extends Homey.Device
{
    async onInit() {
        this.log('MyApp has been initialized');
        this.flows = {    
        };
    
        this.initializeTriggers();
        this.initializeActions();
    
    
      }


      
  initializeTriggers() {
    var triggerCards = {};
    this.flows.triggers = triggerCards;
    for (let triggerCardIndex = 0; triggerCardIndex < homeyApi.app.manifest.flow.triggers.length; triggerCardIndex++) {
      const triggerCard = homeyApi.app.manifest.flow.triggers[triggerCardIndex];
      var card = this.homey.flow.getDeviceTriggerCard(triggerCard.id);
      triggerCards[triggerCard.id] = {
        id: triggerCard.id,
        card: card,
        manifest : triggerCard,
        flows:[]
      }
      //check if flow is enabled
      card.registerRunListener(async (args, state) => {
        // console.log(triggerCard.id + '.registerRunListener: ');
        // console.log(args);
        // console.log(state);
        // console.log('returns ' + args.id && args.id.id && state.id && state.id.id && args.id.id == state.id.id);
        return args.id && args.id.id && state.id && state.id.id && args.id.id == state.id.id;
      });
      if (triggerCard.args) {
        if (triggerCard.args.find(x => x.name == 'id' && x.type == 'autocomplete')) {
          card.getArgument('id').registerAutocompleteListener(async (query, args) => {
            try {
              var array = _.map(triggerCards[triggerCard.id].flows, flow=> { return flow.trigger.args && flow.trigger.args.id ? Number.parseInt(flow.trigger.args.id.id) : null });
              var max = _.max(array);
              if(!max) max=1; else max++;
              var res = [{id:max.toString(), name:max.toString()}];
              if(query && query!=max.toString()) res.push( {id:query, name:query});
              return res;              
            } catch (error) {
              this.error(error);
            }
          });
          card.on('update', this.refreshFlowTriggers.bind(this, triggerCards[triggerCard.id]))
          this.refreshFlowTriggers(triggerCards[triggerCard.id]);
        }
      }
    }
  }
  
  
  //Build in notification if double ID!
  async refreshFlowTriggers(trigger) {
    // console.log('refreshFlowTriggers');
    // console.log(trigger);
    //trigger.card.getAr
    var flows = await homeyApi.getOwnTriggerFlows({device:this, refresh:true, triggerCardId:trigger.id});
    this.log('refreshFlowTriggers', flows);
    trigger.flows = flows || [];
  }


  initializeActions() {
    var actionsCards = {};
    this.flows.actions = actionsCards
    for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow.actions.length; actionCardIndex++) {
      const actionCard = homeyApi.app.manifest.flow.actions[actionCardIndex];
      var card = this.homey.flow.getActionCard(actionCard.id);
      actionsCards[actionCard.id] = {
        id: actionCard.id,
        card: card,
        manifest : actionCard
      };
      card.registerRunListener(async (args, state) => {
        try {          
          // console.log(actionCard.id + '.registerRunListener: ');
          // console.log(args);
          // console.log(state);
          var flow = await homeyApi.getFlow({ id: args.flow.id });
          if (!flow.enabled) return true;
          var filledArgs = {};
          for (const key in _.orderBy(actionCard.args, arg=>arg.name)) {
            if (Object.hasOwnProperty.call(actionCard.args, key)) {
              const arg = actionCard.args[key];
              var type = arg.name.split('_')[0];
              switch (type) {
                case 'text':
                  fillArgs('text', args, arg);                
                  break;
                case 'number':
                  fillArgs('number', args, arg);
                  break;
                case 'boolean':
                  fillArgs('boolean', args, arg);
                  break;
                default:
                  break;
              }
            }
          }
          var argsToUse = {};
          var ownFlowItem = this.flows.triggers[flow.trigger.id];
          for (const key in _.orderBy(ownFlowItem.manifest.tokens, arg=>arg.name)) {
            if (Object.hasOwnProperty.call(ownFlowItem.manifest.tokens, key)) {
              const token = ownFlowItem.manifest.tokens[key];
              if(token.name.split('_').length>2) continue;
              switch (token.type) {
                case 'string':
                  fillTokens('text');
                  break;
                case 'number':
                  fillTokens('number');
                  break;
                case 'boolean':
                  fillTokens('boolean');
                  break;
                default:
                  break;
              }
            }
          }
          var triggerArgs = {};
          for (const key in argsToUse) {
            if (Object.hasOwnProperty.call(argsToUse, key)) {
              const arg = argsToUse[key];
              for (let i = 0; i < arg.length; i++) {
                const val = arg[i] || defaults[key];
                triggerArgs[key+'_'+(i+1)] = (key=='boolean' ? val=='true' : val) ;
                triggerArgs[key+'_'+(i+1) + '_hasvalue'] = val !=null && (key=='boolean' || val !=defaults[key]) && !(key=='text' && val =='null');
              }
            }
          }
          console.log('triggerArgs');
          console.log(triggerArgs);
          ownFlowItem.card.trigger(args.device, triggerArgs, { id: { id: flow.trigger.args.id.id } });

          function fillArgs(type, args, arg) {
            if(!filledArgs[type]) filledArgs[type] = [];
            filledArgs[type].push(type == 'boolean' ? args[arg.name]=='true' :  args[arg.name] || null);
          }
          function fillTokens(type) {
            if(!argsToUse[type]) argsToUse[type] = [];
            var val = filledArgs && filledArgs[type] && filledArgs[type].length> argsToUse[type].length ? filledArgs[type][argsToUse[type].length] : null;
            argsToUse[type].push(val);
          }
        } catch (error) { this.error(error) }
      });
      if (actionCard.args) {
        if (actionCard.args.find(x => x.name == 'flow' && x.type == 'autocomplete')) card.getArgument('flow').registerAutocompleteListener(async (query, args) => {
          this.log(actionCard.id + '.flow.registerAutocompleteListener: ', actionCard.args);
          //console.log(query);
          //console.log(args);
          try {

            var flows = await homeyApi.getOwnTriggerFlows({args: actionCard.args, device:args.device, cardId : actionCard.id.split('__')[1] });
            // var flow = flows ? _.find(flows, x=>x.trigger.uri=='homey:app:nl.qluster-it.FlowEnhancer') : null;
            this.log('flows', flows);
            //console.log(flows);
            if (query) flows = flows.filter(f => f.name.toLowerCase().indexOf(query.toLowerCase()) > -1);
            return flows.map(f => {
              return { id: f.id, name: f.name }
            });
          } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); }
        });
      }
    }
  }



}

module.exports = FlowGroupDevice;