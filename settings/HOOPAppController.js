angular.module('HOOPApp', ['smart-table'])
    .controller('HOOPAppController', function($scope) {
        this.messages = '';
        this.selected = {};
        this.homey;

        this.setHomey = function(homey, scope, log) {
            this.homey = homey;
            this.log = function(s) { return log(s);}
            this.functions = [];
            this.scope = scope;
            
            try {
            
                this.getAuthorizationCode();
                this.getFunctionFromSettings();
                this.getClientStuff();                
            } catch (error) {
                this.homey.alert('error: ' + error);
            }
            
        }
        this.getAuthorizationCode = function() {
            //this.homey.alert('retrieving code');
            this.homey.get('authorizationcode', (err, code)=> {
               // if(!err) this.homey.alert('code retrieved' + code);
                try {
                    if(!err) this.scope.$apply(()=> {
                        this.authorizationcode = code;                            
                    });
                } catch (error) {                        
                    this.homey.alert('error:' + error);
                }
            });
        }
        this.getFunctionFromSettings = function() {
            this.homey.get('flowvariables_functions', (err, newFunctions)=> {                
                if(!err && !newFunctions) {
                    newFunctions = [];
                }
                this.scope.$apply(()=> {
                    this.functions = newFunctions;
                });
            }); 
        }

        this.getClientStuff = function() {
            this.homey.get('clientid', (err, res) => {                    
                //if(!err) this.homey.alert('clientid:' + res);                    
                if(!err) this.scope.$apply(()=> {
                    this.clientid = res;
                });
            });
            this.homey.get('clientsecret', (err, res) => {              
                if(!err) this.scope.$apply(()=> {
                    try{
                        this.clientsecret = res;
                    } catch (error) {                        
                        this.homey.alert('errorclientsecret:' + error);
                    }
                });
            });
            this.homey.get('homeyid', (err, res) => {                    
                //if(!err) this.homey.alert('clientid:' + res);                    
                if(!err) this.scope.$apply(()=> {
                    this.homeyid = res;
                });
            });
            
        }
        this.saveAthomClient = function() {
            this.homey.set('clientid', this.clientid);
            this.homey.set('clientsecret', this.clientsecret);
            this.setAthomClient();
        }
        this.setAthomClient = function() {
            AthomCloudAPI.setConfig({
                clientId: this.clientid, //Obtained through the developer portal/Athom
                clientSecret: this.clientsecret, //Obtained through the developer portal/Athom
                callbackUrl: 'http://localhost', //Configured through developer portal
                redirectUrl: 'http://localhost',//'https://cli.athom.com?clientid='+this.homeyid,//'http://localhost', //Configured through developer portal
                autoRefreshTokens: 1,
                scopes: ['homey.device.readonly', 'homey.zones.readonly', 'homey.flow.readonly', 'homey.flow.start']
            });

            let cloudAPI = new AthomCloudAPI(
                {
                    store: new AthomStorageAdapter.LocalStorage('_athom_cloud_api')
                }
            );
            this.cloudurl = cloudAPI.getLoginUrl(['homey.device.readonly', 'homey.zones.readonly', 'homey.flow.readonly', 'homey.flow.start']);
        }

        this.clearToken = function() {
            this.homey.set('cleartoken', true);
            this.homey.alert('Token cleared, restart App or create another Homey Elevator.');
        }

        this.saveCode = function() {
            this.homey.set('authorizationcode', this.authorizationcode);
            this.homey.alert('Code saved.');
        }

        this.savefunctions = function() {
            this.homey.set('flowvariables_functions', this.functions);
            this.homey.alert('Functions saved');
        }

        this.addFunction = function() {
            try {                
                this.log('addFunction');
                if (this.functions && this.functions.filter(function(e) { return e.name == this.newFunction.name; }).length > 0) {
                    this.messages = "Function already exists.";
                    return;
                }
                var func = {
                    name: this.newFunction.name,
                    value:undefined,
                    remove: false
                };
                this.functions.push(func);
                this.storeFunction();
                this.messages = '';
                this.newFunction = {}                
                this.log('addFunction done');
            } catch (error) {                           
                this.log('addFunction error: ' + error);
                this.messages = error;
            }
        };
        this.deleteAll = function() {
            this.homey.confirm('Are you sure you wish to delete ALL functions?', null, () => {
                this.functions = [];
                storeFunction();
            })
        }
        this.removeFunction = function(row) {
            this.homey.confirm('Are you sure you wish to delete function '+row.name+'?', null, () => {
                
            var index = this.functions.indexOf(row);
            this.functions.splice(index, 1);
            storeFunction();
            })
        };
        this.editFunction = function(row) {
            this.editFunctionItem = row;
        };
        this.saveActiveFunction = function(close) {
            this.storeFunction();
            if(close)this.editFunctionItem = null;
        };

        this.storeFunction = function() {
            this.homey.set('flowvariables_functions', angular.copy(this.functions));
        }
    });
