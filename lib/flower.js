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

    static async triggerFlow({flow, tokens, actioncardsmode}) {
        var defer = new Defer();
        flow = await homeyApi.getFlow(flow);
        this.log('flow', JSON.stringify(flow));
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
                var res = await (await homeyApi.getHomeyAPI()).flow.runFlowCardCondition(condition);
                this.log('res', res);
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
            
            var promise = (await homeyApi.getHomeyAPI()).flow.runFlowCardAction(action).catch(err=> {
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