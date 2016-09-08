'use strict';
var WxBase = require('co-wxbase');
var crypt = require('crypto');
var request = require('request');
const DAY = 1000*60*60*24;
const ENDOFDAY = DAY - 1;
function md5(val){
  return crypt.createHash('md5').update(val).digest('hex');
}

class WxCustomService extends WxBase {
  constructor(opts){
    super(opts);
    this.account = opts.wxaccount || opts.wx_account || opts.wxAccount || opts.account;
  }

  _checkAccount(){
    if ( !this.account ) throw new Error('Not wechat account is configured, please configure it before using wxapi!');
  }

  *getRecords(time, msgid, count, access_token){
    var accessToken = access_token;
    if ( !accessToken ) accessToken = yield this.provider.getAccessToken();
    var ts = (time instanceof Date)?time.getTime():time;
    if ( !ts ) {
      ts = new Date().getTime();
      ts = ts - ts % DAY;
    }
    var endts = ts - (ts % DAY) + ENDOFDAY;
    msgid = parseInt(msgid) || 1;
    count = parseInt(count) || 1000;
    if ( count > 10000 ) count = 10000;
    if ( count <= 0 ) count = 1000;
    var url = `https://api.weixin.qq.com/customservice/msgrecord/getmsglist?access_token=${accessToken}`;
    var params = {
      starttime: parseInt(ts/1000),
      endtime: parseInt(endts/1000),
      msgid: msgid,
      number: count
    }
    console.log(url, params);
    var result = yield this.jsonRequest(url, 'POST', params);
    return result;
  }

  *transfer(touser, account){
    this._checkAccount();
    var now = new Date().getTime();
    var params = {
      ToUserName: touser,
      FromUserName: this.account,
      CreateTime: now,
      MsgType: 'transfer_customer_service'
    };
    if( account ) {
      var kfaccount = account.indexOf('@')>0?account:account+'@'+this.account;
      params.TransInfo = {KfAccount: kfaccount}
    }
    return params;
  }

  *_accountOp(op, account, nickname, password, access_token) {
    this._checkAccount();
    var accessToken = access_token;
    if ( !accessToken ) accessToken = yield this.provider.getAccessToken();
    var url = `https://api.weixin.qq.com/customservice/kfaccount/${op}?access_token=${accessToken}`;
    var kfaccount = account.indexOf('@')>0?account:account+'@'+this.account;
    var params = {
      kf_account: kfaccount,
      nickname: nickname,
      password: md5(password)
    }
    var result = yield this.jsonRequest(url, 'POST', params);
    return result;
  }

  *createAccount(account, nickname, password, access_token) {
    return yield this._accountOp('add', account, nickname, password, access_token);
  }

  *invite(account, wxuser, access_token) {
    var accessToken = access_token;
    if ( !accessToken ) accessToken = yield this.provider.getAccessToken();
    var url = `https://api.weixin.qq.com/customservice/kfaccount/inviteworker?access_token=${accessToken}`;
    var params = {
      kf_account: account,
      invite_wx : wxuser
    };
    var result = yield this.jsonRequest(url, 'POST', params);
    return result;
  }

  *updateAccount(account, nickname, password, access_token) {
    return yield this._accountOp('update', account, nickname, password, access_token);
  }

  *deleteAccount(account, access_token) {
    this._checkAccount();
    var accessToken = access_token;
    if ( !accessToken ) accessToken = yield this.provider.getAccessToken();
    var kfaccount = encodeURIComponent(account.indexOf('@')>0?account:account+'@'+this.account);
    var url = `https://api.weixin.qq.com/customservice/kfaccount/del?access_token=${accessToken}&kf_account=${kfaccount}`;
    var result = yield this.jsonRequest(url, 'GET');
    return result;
  }

  //jpg < 5M, better be 640x640
  *setAccoutAvatar(account, uri, access_token) {
    this._checkAccount();
    var accessToken = access_token;
    if ( !accessToken ) accessToken = yield this.provider.getAccessToken();
    var kfaccount = encodeURIComponent(account.indexOf('@')>0?account:account+'@'+this.account);
    var url = `https://api.weixin.qq.com/customservice/kfaccount/uploadheadimg?access_token=${accessToken}&kf_account=${kfaccount}`;
    var stream;
    if ( uri.startsWith('http://') || uri.startsWith('https://') ) {
      stream = this._request.get(uri);
    }
    else {
      stream = fs.createReadStream(uri);
    }
    var result = yield this.rawRequest(url, 'POST', null, {formData: {media: stream}});
    return result;
  }

  *getAccounts(access_token){
    var accessToken = access_token;
    if ( !accessToken ) accessToken = yield this.provider.getAccessToken();
    var url = `https://api.weixin.qq.com/cgi-bin/customservice/getkflist?access_token=${accessToken}`;
    var result = yield this.jsonRequest(url, 'GET');
    return result;
  }

  *getOnlineAccounts(access_token){
    var accessToken = access_token;
    if ( !accessToken ) accessToken = yield this.provider.getAccessToken();
    var url = `https://api.weixin.qq.com/cgi-bin/customservice/getonlinekflist?access_token=${accessToken}`;
    var result = yield this.jsonRequest(url, 'GET');
    return result;
  }

  *_sessionOp(op, account, openid, access_token){
    var accessToken = access_token;
    if ( !accessToken ) accessToken = yield this.provider.getAccessToken();
    var kfaccount = account.indexOf('@')>0?account:account+'@'+this.account;
    var url = `https://api.weixin.qq.com/customservice/kfsession/${op}?access_token=${accessToken}`;
    var params = {
      kf_account: kfaccount,
      openid: openid
    }
    var result = yield this.jsonRequest(url, 'POST', params);
    return result;
  }

  *createSession(account, openid, access_token){
    return yield this._sessionOp('create', account, openid, access_token);
  }

  *closeSession(account, openid, access_token){
    return yield this._sessionOp('close', account, openid, access_token);
  }

  *getSession(openid, access_token){
    var accessToken = access_token;
    if ( !accessToken ) accessToken = yield this.provider.getAccessToken();
    var url = `https://api.weixin.qq.com/customservice/kfsession/getsession?access_token=${accessToken}&openid=${openid}`;
    var result = yield this.jsonRequest(url, 'GET');
    return result;
  }

  *getSessions(account, access_token){
    var accessToken = access_token;
    if ( !accessToken ) accessToken = yield this.provider.getAccessToken();
    var kfaccount = account.indexOf('@')>0?account:account+'@'+this.account;
    var url = `https://api.weixin.qq.com/customservice/kfsession/getsessionlist?access_token=${accessToken}&openid=${openid}`;
    var result = yield this.jsonRequest(url, 'GET');
    return result;
  }

  *getWaitCases(access_token){
    var accessToken = access_token;
    if ( !accessToken ) accessToken = yield this.provider.getAccessToken();
    var url = `https://api.weixin.qq.com/customservice/kfsession/getwaitcase?access_token=${accessToken}`;
    var result = yield this.jsonRequest(url, 'GET');
    return result;
  }

  *send(msg, access_token){
    var accessToken = access_token;
    if ( !accessToken ) accessToken = yield this.provider.getAccessToken();
    var url = `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`;
    var result = yield this.jsonRequest(url, 'POST', msg);
    return result;
  }
}

module.exports = function(opts){
  var api = new WxCustomService(opts);
  return api;
}
