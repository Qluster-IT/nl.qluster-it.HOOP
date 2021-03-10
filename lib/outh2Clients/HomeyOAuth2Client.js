
const { OAuth2Client, OAuth2Error } = require('homey-oauth2app');

const OAuth2ClientMini = require('./OAuth2ClientMini');

const fetch = require('node-fetch');
const { Defer } = require('../proto');


module.exports = class HomeymanOAth2Client extends OAuth2ClientMini {

  // Overload what needs to be overloaded here

  async onHandleNotOK({ body }) {
      throw new OAuth2Error(body.error);
  }

  async onRequests () {
    await this.login();
  }

  
  async getSessionToken() {
    return this.login();
  }

  async login() {
    //console.log('oauth login');
    this.ip = (await this.homey.cloud.getLocalAddress()).split(':')[0];
		
    var defer = new Defer();
    const token = await this.getToken();
    if (!token) {
      throw new OAuth2Error('Missing Token');
    }

    const { access_token: accessToken } = token;
    fetch('https://api.athom.com/delegation/token?audience=homey', {
      method: 'POST',
      headers:{
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',        
        'Authorization': `Bearer ${accessToken}`
      }
    })
    .catch(function(a,b){
        console.log('login error');
        console.log(a);
        defer.resolve(false);
    }.bind(this)
    ).then(async function(response) {
        var code = await response.json();
        fetch('http://'+this.ip+'/api/manager/users/login', {
            method: 'POST',
            body: JSON.stringify({token:code}),
            headers:{
              'Accept': 'application/json',
              'Content-Type': 'application/json' //Dont use bearer here
            }
        }).then((async (bearer)=>{          
          console.log(' -------------- bearer  ---------------');          
          this.accessToken = await bearer.json();
          console.log(this.accessToken);
          defer.resolve(this.accessToken);
        }).bind(this))
        .catch(((err)=>{
          console.log('bearer error');
          console.log(err);
          defer.resolve(false);
        }).bind(this))
    }.bind(this));

    return defer.promise;
  }

  async onInit() {

  }

  async try(type, par) {
    try {
      // console.log('try ' + type);
      // console.log('par');
      // console.log(par);
      return this[type](par);
    } catch (error) {
      console.log('try error: ' + type);
      console.log('par: ');
      console.log(par);
      console.error(error);
      try {        
        await this.login();
        return this[type](par);
      } catch (error) {
        if(this.refresh) await this.refresh();
        await this.login();
        return this[type](par);
      }
    }
  }

  async getMe() {
    return this.try('get', {
      path: '/manager/sessions/session/me'
      //query: { color },
    });
  }

  async getFlows() {
    return this.try('get', {
      path: '/manager/flow/flow'
      //query: { color },
    });
  }

  async getFlow({id}) {
    return this.try('get', {
      path: '/manager/flow/flow/'+id//,
      //query: args,
    });
  }

  async getDevices() {
    return this.try('get', {
      path: '/manager/devices/device'
      //query: { color },
    });
  }
  async getDevice({id}) {
    return this.try('get', {
      path: '/manager/devices/device/'+id
    });
  }

  
  async getFlowCardTrigger({uri, id}) {
    return this.try('get', {
      path: '/manager/flow/flowcardtrigger/'+uri + '/' + id
    });
  }

  
  async getFlowCardCondition({uri, id}) {
    return this.try('get', {
      path: '/manager/flow/flowcardcondition/'+uri + '/' + id
    });
  }

  
  async getFlowCardAction({uri, id}) {
    return this.try('get', {
      path: '/manager/flow/flowcardaction/'+uri + '/' + id
    });
  }

  
  
  async runFlowCardTrigger({uri, id, args, droptoken}) {
    return this.try('post', {
      path: '/manager/flow/flowcardtrigger/'+uri + '/' + id +'/run',
      json:{args, droptoken}
    });
  }

  
  async runFlowCardCondition({uri, id, args, droptoken}) {
    return this.try('post', {
      path: '/manager/flow/flowcardcondition/'+uri + '/' + id +'/run',
      json:{args, droptoken}
    });
  }

  
  async runFlowCardAction({uri, id, args, droptoken}) {
    return this.try('post', {
      path: '/manager/flow/flowcardaction/'+uri + '/' + id +'/run',
      json:{args, droptoken, droptoken}

    });
  }

  
  
  async getFlowCardTriggers() {
    return this.try('get', {
      path: '/manager/flow/flowcardtrigger'
    });
  }

  
  async getFlowCardConditions() {
    return this.try('get', {
      path: '/manager/flow/flowcardcondition'
    });
  }

  
  async getFlowCardActions() {
    return this.try('get', {
      path: '/manager/flow/flowcardaction'
    });
  }
  


  async getTest() {
    return this.try('get',{
      path: '/manager/flow/flow/c36da34e-8983-4e63-8c39-8dd81bc366d6'
      //query: { color },
    });
  }

  async getThings({ color }) {
    return this.try('get',{
      path: '/things',
      query: { color },
    });
  }

  async updateVariable({ id, value }) {
    return this.try('put',{
      path: `/manager/logic/variable/${id}`,
      json: { value },
    });
  }

  async triggerFlow({ id, state }) {
    return this.try('post',{
      path: `/manager/flow/flow/${id}/trigger`,
      json: state,
    });
  }
}