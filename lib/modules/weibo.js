var oauthModule = require('./oauth2')
  , url = require('url')
  , request = require('request');

var weibo = module.exports =
oauthModule.submodule('weibo')
  .configurable({
    scope: "There's no idea about weibo's scope"
  })
  
  //fetch weibo user needs userid in extra
  .step('fetchOAuthUser')
      .accepts('accessToken extra')
      .promises('oauthUser')

  .oauthHost('https://api.weibo.com')
  .apiHost('https://api.weibo.com')

  .authPath('/oauth2/authorize')
  .authQueryParam('response_type', 'code')
  
  .accessTokenPath('/oauth2/access_token')
  .accessTokenParam('grant_type', '')
  .postAccessTokenParamsVia('data')

  .entryPath('/auth/weibo')
  .callbackPath('/auth/weibo/callback')
  
  .authQueryParam('scope', function () {
    return this._scope && this.scope();
  })

  .getAccessToken( function (code) {
    var p = this.Promise()
      , url = this._oauthHost + this._accessTokenPath
      , opts = { url: url };

    opts.form = {
        client_id: this._appId
      , redirect_uri: this._myHostname + this._callbackPath
      , code: code
      , client_secret: this._appSecret
    };
    
    request.post( opts, function(err, res, body){
      var data;
      if (err) {
        p.fail(err);
      } else {
        data = JSON.parse(body); // sina weibo return a JSON with text/plain
        p.fulfill(data.access_token, data);
        delete data.access_token;
      }
    });
    return p;
  })
  .fetchOAuthUser( function (accessToken, extra) {
    var p = this.Promise();
    var uid = extra.uid;
    var url = this.apiHost() + "/2/users/show.json?uid=" + uid;
    
    this.oauth.get(url, accessToken, function (err, user) {
      if (err) {
        p.fail(err);
      }else{
        p.fulfill(JSON.parse(user));
      }
    });
    
    return p;
  })
  .addToSession( function (sess, auth) {
    this._super(sess, auth);
    if (auth.refresh_token) {
      sess.auth[this.name].refreshToken = auth.refresh_token;
      sess.auth[this.name].expiresInSeconds = parseInt(auth.expires_in, 10);
    }
  })  
  .authCallbackDidErr( function (req) {
    var parsedUrl = url.parse(req.url, true);
    return parsedUrl.query && !!parsedUrl.query.error;
  })
  .handleAuthCallbackError( function (req, res) {
    var parsedUrl = url.parse(req.url, true)
      , errorDesc = parsedUrl.query.error + "; " + parsedUrl.query.error_description;
    if (res.render) {
      res.render(__dirname + '/../views/auth-fail.jade', {
        errorDescription: errorDesc
      });
    } else {
      // TODO Replace this with a nice fallback
      throw new Error("You must configure handleAuthCallbackError if you are not using express");
    }
  })  
  .convertErr( function (err) {
    return new Error(err.data ? err.data : err);
  });
