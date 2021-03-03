'use strict';

const Homey = require('homey');
const { v4: uuidv4 } = require('uuid');
    

class FlowDirectorDriver extends Homey.Driver
{
    async onInit()
    {
        this.log('FlowDirectorDriver has been initialized');        
    }


    async onPairListDevices(data)
    {
        return {
            "name": 'Flow Director',
            data:
            {
                "id": uuidv4()
            }
        };
    }
}

module.exports = FlowDirectorDriver;