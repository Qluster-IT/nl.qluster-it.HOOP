const _ = require('lodash');

class Shared {

    static registerAutocompleteListenerCard({homeyApi, cardType, cardToUser, actionCard}) {
        return (async function (query, args) {
            try {
              var flowCards = await homeyApi.getFlowCards({type:cardType});
              var refType = cardType =='actions' ? 'Action' : cardType =='conditions' ? 'Condition' : 'Trigger';
              
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
                //time
                && cardToUser.count.time == _.sumBy( card.args, arg=> arg.type=='time') 
                
              });
    
              
              let r = flowCards.map(f => {
                /// WHATS OUT, ALL NEED TO BE SAME!
                if(f.uri.startsWith('homey:device:')) {
                  return { id: f.uri +'_' + f.id, name: f.uriObj.name + ' - ' + f.title, description: f.id, order:1, isDevice: true, refUri:f.uri, refId : f.id, refType : refType};//f.__athom_api_type };
                } if(f.uri.startsWith('homey:zone:')) {
                  return { id: f.uri +'_' + f.id, name: f.uriObj.name + ' - ' + f.title, description: f.id, order:1, isDevice: true, refUri:f.uri, refId : f.id, refType : refType};//f.__athom_api_type };
                } else return { id: f.uri +'_' + f.id, name: f.uriObj.name + ' - ' + f.title, description: f.uri + ' - ' + f.id, order:0, refUri:f.uri, refId : f.id, refType : refType};//f.__athom_api_type }
              });
              //this.log('query ', '"'+query+'"' );
              if (query) r = _.filter(r, (f) => f.name.toLowerCase().indexOf(query.toLowerCase()) > -1 || f.description.toLowerCase().indexOf(query.toLowerCase()) > -1 );
              this.log('result:', r);
              r = _.uniqBy(r, card => card.refUri + card.refId);
    
              r = _.orderBy(r, [card => card.order, card => card.name, card => card.id ]);
              return r;
            } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
          }).bind(this);
    }
    static registerAutocompletes({actionCard, homeyApi, Flower, card }) {
      if (actionCard.args.find(x => x.name.indexOf('autocomplete')>-1)) actionCard.args.filter(x => x.name.indexOf('autocomplete')>-1).forEach(arg=>{
        const argName = arg.name;
        card.getArgument(argName).registerAutocompleteListener(async (query, args) => {
          try {
            if(!args.card || !args.card.refType) return false;
            const type = args.card.refType.indexOf('Condition') >-1 ? 'conditions' : args.card.refType.indexOf('Trigger') >-1 ? 'triggers' : 'actions';
            const card = await homeyApi.getFlowCard({ uri: args.card.refUri ,id: args.card.refId, type:type });
            if (!card) return false;                  
            var triggerArgs = Flower.getArgsForAutocomplete({ args, actionCard, triggerCard:card });                  
            var promise = Flower.getFlowCardAutocomplete({ card, args: triggerArgs, type:type, query, autocompleteNumber:1 });
            var r = await promise;
            return r;

          } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
        });
      });
    }

    static registerDropdowns({actionCard, homeyApi, card }) {
      if (actionCard.args.find(x => x.name.indexOf('dropdown')>-1)) actionCard.args.filter(x => x.name.indexOf('dropdown')>-1).forEach(arg=>{
        const argName = arg.name;
        var argIndex = Number.parseInt(arg.name.replace("dropdown_","")) - 1;
        card.getArgument(argName).registerAutocompleteListener(async (query, args) => {
          try {
            console.log('registerAutocompleteListener args.card');
            console.log(args.card);
            const type = args.card.refType.indexOf('Condition') >-1 ? 'conditions' : args.card.refType.indexOf('Trigger') >-1 ? 'triggers' : 'actions';
            const card = await homeyApi.getFlowCard({ uri: args.card.refUri ,id: args.card.refId, type:type });
            if (!card) return false;
            //Only first is option right now.
            this.log('card.args', card.args);
            var argList =_.filter(card.args, a=> a.type=='dropdown'); 
            var arg = argList[argIndex];// _.find(card.args, a=> a.type=='dropdown');// && !(arg.values.length==2 && (arg.values[0].id === 'true' || arg.values[0].id==='false' ) && (arg.values[1].id === 'true' || arg.values[1].id==='false' ))
            this.log('arg', arg)
            if(!arg) return false;

            this.log('arg', arg);
            return arg.values;

          } catch (error) { this.error(actionCard.id + '.flow.registerAutocompleteListener.error :', error); throw error; }
        });
      }); 
    }
    
}

module.exports = Shared;