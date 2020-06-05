const shortID = require('shortid');

module.exports = class Player {
    constructor() {
        this.username = '';
        this.roomid = '';
        this.playerid = shortID.generate();
    }
}
