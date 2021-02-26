'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');
    

class FlowGroupDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('FlowGroupDriver has been initialized');        
    }


    async onPairListDevices(data)
    {
        return {
            "name": 'Flow Group',
            data:
            {
                "id": uuidv4()
            },
            settings:
            {
                "overloading": "false"
            }
        };
    }
}

module.exports = FlowGroupDriver;