'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');
    
const homeyApi = require('../../lib/homeyApi');
const _ = require('lodash');
const Flower = require('../../lib/flower');

const { Defer } = require('../../lib/proto');

class CardOverloaderDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('CardOverloaderDriver has been initialized');    
        this.flows = {};
        Flower.init(null, this);
    
        this.initializeConditionsAndActions();    
    }


    async onPairListDevices(data)
    {
      const firstId = 'actioncardsdevice';
      let devices = this.getDevices();
      if(devices && devices.length>0) devices = _.filter(devices, device=> device.getDate().id==firstId);
      var id = devices && devices.length>0 ? uuidv4() : firstId;
        return {
            "name": 'Action Cards',
            data:
            {
                "id": id
            }
        };
    }

    
  initializeConditionsAndActions() {
    ['actioncards_condition__','actioncards_action__'].forEach((cardName => {
        const cardType = cardName.startsWith('actioncards_condition_') ? 'conditions' : 'actions';
        const actionsCards = {};
        this.flows[cardType] = actionsCards
        for (let actionCardIndex = 0; actionCardIndex < homeyApi.app.manifest.flow[cardType].length; actionCardIndex++) {
          const actionCard = homeyApi.app.manifest.flow[cardType][actionCardIndex];
          if (!actionCard.id.startsWith('actioncards_')) continue;
          const card = this.homey.flow[cardType =='actions' ? 'getActionCard': 'getConditionCard'](actionCard.id);
          const cardToUser = actionsCards[actionCard.id] = {
            id: actionCard.id,
            card: card,
            manifest: actionCard,
            count: {
              text:0,
              number:0,
              boolean:0,
              autocomplete:0,
              dropdown:0
            }
          };
          let types = actionCard.id.split('__')[1].split('_');
          _.forEach(types, t=> {
            if(t.startsWith('text')) cardToUser.count['text']= Number.parseInt( t.replace('text',''));
            else if(t.startsWith('number')) cardToUser.count['number']= Number.parseInt( t.replace('number',''));
            else if(t.startsWith('range')) cardToUser.count['range']= Number.parseInt( t.replace('range',''));            
            else if(t.startsWith('boolean')) cardToUser.count['boolean']= Number.parseInt( t.replace('boolean',''));
            else if(t.startsWith('autocomplete')) cardToUser.count['autocomplete']= Number.parseInt( t.replace('autocomplete',''));
            else if(t.startsWith('dropdown')) cardToUser.count['dropdown']= Number.parseInt( t.replace('dropdown',''));
          });
          cardToUser.count.number += cardToUser.count.range || 0;
          
          card.registerRunListener((args, state) => {
            const defer = new Defer();
            try {
              (async ()=>{
                  if(!args.card || !args.card.refType) return defer.reject('no uri given');
                  const type = args.card.refType.indexOf('Condition') >-1 ? 'conditions' : 'actions';
                  const card = await homeyApi.getFlowCard({ uri: args.card.refUri ,id: args.card.refId, type:type });
                  if (!card) return defer.reject('no card found');
                    
                  // var triggerArgs = Flower.getArgsForTokens({ flow, args, actionCard });
                  
                  // var promise = Flower.triggerFlow({ flow, tokensAsArgs: triggerArgs });
                  // if(cardType=='conditions') return await promise;
                  // else return true;
                  
                  //this.log('args -->', args);
                  var manifest = await homeyApi.getFlowCard({ uri:  args.card.refUri ,id: args.card.refId, type:type });
                  
                  this.log('manifest.args -->', manifest.args);
                  if(manifest.args && manifest.args.length>0 ) this.log('manifest.args[0] -->', manifest.args[0]);
                  var triggerArgs = Flower.getArgsForArgs({ args, actionCard, triggerCard:manifest });
                  //var triggerArgs = Flower.getArgsForTokens({ args, actionCard, triggerCard:triggerManifest });

                  this.log('triggerArgs -->', triggerArgs);

                  //var argsToUse = Flower.getArgsForTokens({ flow, args, actionCard:card, triggerCard:triggerManifest  });
                  var promise = Flower.triggerCard({ card, args: triggerArgs, type:type });
                  this.log('flow triggered' ); 
                  

                  if(cardType=='conditions') {
                    promise.then(r=> {
                      this.log('r = ', r);
                      defer.resolve(r===undefined || r===null ? true : r);
                    }).catch(err=> {
                      this.log('err in it', err);
                      this.error(err);
                      defer.reject((err.name || err) + ' within ' + card.uri + '.' + card.id);
                    });
                  } 
                  else return defer.resolve(true);
              }).call(this).then(res=> {
              }).catch(err=> {
                this.log('Error triggering CardOverloader Card 2');this.error(err); defer.reject('Error message');
              })
              

            } catch (error) { this.log('Error triggering CardOverloader Card (3)');this.error(error); defer.reject('Error message'); }
            return defer.promise;
          });
          //this.log('actionCard.args', actionCard.args);
          if (actionCard.args) {
            if (actionCard.args.find(x => x.name == 'card' && x.type == 'autocomplete')) card.getArgument('card').registerAutocompleteListener(async (query, args) => {
              try {
                var flowCards = await homeyApi.getFlowCards({type:'actions'});
                //var flowCardsConditions = await homeyApi.getFlowCards({type:'conditions'});
                //var flowCardsActions = await homeyApi.getFlowCards({type:'actions'});
                //var flowCards = _.union(flowCardsConditions, flowCardsActions);
                
                //if (query) flowCards = flowCards.filter(f => f.uri.toLowerCase().indexOf(query.toLowerCase()) > -1);
                //this.log('flowCards', JSON.stringify(flowCards[0], null, 2));//_.find(flowCards, c=> c.uriObj && c.uriObj.name=='Hoofdlamp badkamer'));
                
                this.log('cardToUser.count', cardToUser.id, cardToUser.count);
                
                flowCards = flowCards.filter(card => 
                  {
                  return _.every(['text',  'autocomplete'], type=>  _.sumBy( card.args, arg=> arg.type==type)==cardToUser.count[type])
                  && cardToUser.count.number == _.sumBy( card.args, arg=> arg.type=='number' || arg.type=='range') 
                  //boolean
                  && cardToUser.count.boolean == _.sumBy( card.args, arg=> 
                    (arg.type=='dropdown' && arg.values.length==2 && (arg.values[0].id === 'true' || arg.values[0].id==='false' ) && (arg.values[1].id === 'true' || arg.values[1].id==='false' ))
                    || (arg.type=='checkbox')
                    )
                  //dropdown
                  && cardToUser.count.dropdown == _.sumBy( card.args, arg=> arg.type=='dropdown' && !(arg.values.length==2 && (arg.values[0].id === 'true' || arg.values[0].id==='false' ) && (arg.values[1].id === 'true' || arg.values[1].id==='false' )))
                });

                
                let r = flowCards.map(f => {
                  /// WHATS OUT, ALL NEED TO BE SAME!
                  if(f.uri.startsWith('homey:device:')) {
                    return { id: f.uri +'_' + f.id, name: f.uriObj.name + ' - ' + f.title, description: f.id, order:1, isDevice: true, refUri:f.uri, refId : f.id, refType : 'Action'};//f.__athom_api_type };
                  } if(f.uri.startsWith('homey:zone:')) {
                    return { id: f.uri +'_' + f.id, name: f.uriObj.name + ' - ' + f.title, description: f.id, order:1, isDevice: true, refUri:f.uri, refId : f.id, refType : 'Action'};//f.__athom_api_type };
                  } else return { id: f.uri +'_' + f.id, name: f.uriObj.name + ' - ' + f.title, description: f.uri + ' - ' + f.id, order:0, refUri:f.uri, refId : f.id, refType : 'Action'};//f.__athom_api_type }
                });
                //this.log('query ', '"'+query+'"' );
                if (query) r = _.filter(r, (f) => f.name.toLowerCase().indexOf(query.toLowerCase()) > -1 || f.description.toLowerCase().indexOf(query.toLowerCase()) > -1 );
                this.log('result:', r);
                r = _.uniqBy(r, card => card.refUri + card.refId);

                r = _.orderBy(r, [card => card.order, card => card.name, card => card.id ]);
                return r;
              } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
            });
            if (actionCard.args.find(x => x.name.indexOf('autocomplete')>-1)) actionCard.args.filter(x => x.name.indexOf('autocomplete')>-1).forEach(arg=>{
              const argName = arg.name;
              card.getArgument(argName).registerAutocompleteListener(async (query, args) => {
                try {
                  if(!args.card || !args.card.refType) return false;
                  const type = args.card.refType.indexOf('Condition') >-1 ? 'conditions' : 'actions';
                  const card = await homeyApi.getFlowCard({ uri: args.card.refUri ,id: args.card.refId, type:type });
                  if (!card) return false;                  
                  var triggerArgs = Flower.getArgsForAutocomplete({ args, actionCard, triggerCard:card });                  
                  var promise = Flower.getFlowCardAutocomplete({ card, args: triggerArgs, type:type, query, autocompleteNumber:1 });
                  var r = await promise;
                  return r;

                } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
              });
            });
            if (actionCard.args.find(x => x.name.indexOf('dropdown')>-1)) actionCard.args.filter(x => x.name.indexOf('dropdown')>-1).forEach(arg=>{
              const argName = arg.name;
              card.getArgument(argName).registerAutocompleteListener(async (query, args) => {
                try {
                  console.log('registerAutocompleteListener args.card');
                  console.log(args.card);
                  const type = args.card.refType.indexOf('Condition') >-1 ? 'conditions' : 'actions';
                  const card = await homeyApi.getFlowCard({ uri: args.card.refUri ,id: args.card.refId, type:type });
                  if (!card) return false;
                  //Only first is option right now.
                  this.log('card.args', card.args)
                  var arg = _.find(card.args, a=> a.type=='dropdown');// && !(arg.values.length==2 && (arg.values[0].id === 'true' || arg.values[0].id==='false' ) && (arg.values[1].id === 'true' || arg.values[1].id==='false' ))
                  this.log('arg', arg)
                  if(!arg) return false;

                  this.log('arg', arg);
                  return arg.values;

                } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
              });
            }); 
          }
        }
        
      }).bind(this));
  }
}

module.exports = CardOverloaderDriver;