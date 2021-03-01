const homeyApi = require("./homeyApi");
const { Defer } = require("./proto");
const _ = require('lodash');

class Flower {    
    static init(app) {
        this.app = app;
        this.homey = app.homey;
        this.log=app.log.bind(app);
        this.error=app.error.bind(app);
    }

    static getRunCard({card, args}) {
        var toRunCard = {};
        for (const key in card) {
            if(key == 'args') {
                toRunCard[key] = args;
                continue;
            }
            if (Object.hasOwnProperty.call(card, key)) toRunCard[key] = card[key];
        }
        return toRunCard;
    }
    static getArgs({args, tokens}) {
        _.forEach(args, (argValue, argKey)=> { 
            if(!_.isObject(argValue)) {
                if (_.isString(argValue)) {
                    //replace tokens
                    var s = argValue;
                    var matches = s.match(/(?<=\[\[).*?(?=\]\])/gs)
                    if(matches && tokens) matches.forEach(match => {
                        if(Object.keys(tokens).indexOf(match)>-1) s = s.replace('[[' + match + ']]', tokens[match]);
                    });
                    args[argKey] = s;

                }
                else if(!_.isString(argValue)) args[argKey] = argValue;
            } else args[argKey] = argValue;
        });
        return args;
    }

    static async triggerFlow({flow, tokensAsArgs, actioncardsmode}) {
        var defer = new Defer();
        flow = await homeyApi.getFlow(flow);
        //this.log('flow', JSON.stringify(flow));
        if(!flow) return defer.reject('Flow not found.');
        else if(!flow.enabled) return defer.reject('Flow disabled.');
        //if(flow.actions.conditions)

        /// Make possible form conditions also to run async (waiting for end result ofc).
        var conditionGroups = ['group1', 'group2', 'group3'];          
        var group = 'then';

        var nextGroup = null;
        for (let conditionGroupI = 0; conditionGroupI < conditionGroups.length; conditionGroupI++) {
            const conditionGroup = conditionGroups[conditionGroupI];
            var conditions = flow.conditions ? _.filter(flow.conditions,fc=>fc.group==conditionGroup) : null;
            //Need to start Async if async
            //Build in delays
            if(conditions) for (let conditionI = 0; conditionI < conditions.length; conditionI++) {
                const condition = conditions[conditionI];
                this.log('condition', condition);
                try {
                    var args = this.getArgs({args:condition.args, tokens: tokensAsArgs})                    
                    var toRunCard = this.getRunCard({card:condition, args})                    
                    var res = await (await homeyApi.getHomeyAPI()).flow.runFlowCardCondition(toRunCard);
                    if((res.result === true && !condition.inverted) || (res.result === false && condition.inverted)) continue
                    if((res.result === false && !condition.inverted) || (res.result === true && condition.inverted))  {
                        nextGroup = true
                        break;
                    }                
                } catch (error) {
                //How to handle erros?
                defer.reject(error);
                }
            }
            if(nextGroup) {
                break;            
            }
        }
        if(nextGroup) group = 'else';

        var actions = flow.actions ? _.filter(flow.actions,fa=>fa.group==group) : null;
        var promises = [];
        //Need to start Async if async
        //Build in delays
        var anyErrored = null;
        if(actions) for (let actionI = 0; actionI < actions.length; actionI++) {
        const action = actions[actionI];
        this.log('action', action);
        try {
            var args = this.getArgs({args:action.args, tokens: tokensAsArgs})                    
            var toRunCard = this.getRunCard({card:action, args})                    
            var promise = (await homeyApi.getHomeyAPI()).flow.runFlowCardAction(toRunCard).catch(err=> {
            this.log('err', err);
            anyErrored = err;
            });
            promises.push(promise);
            if(actioncardsmode=='sync') await promise;
        } catch (error) {
            this.log('error from here');
            this.error(error);
        }
        }
        this.log('app_condition__await finish async:', actioncardsmode)
        Promise.all(promises).then(x=> {
        this.log('resolved');
            if(anyErrored) defer.reject(anyErrored);
            else defer.resolve(true);
        }).catch  (err=> {
            this.log('rejected');
            defer.reject(err);
        });
        return defer.promise;
    }
}


module.exports = Flower;