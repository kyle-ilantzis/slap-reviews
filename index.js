"use strict";

let fs = require('fs');
let path = require('path');
let process = require('process');

let aj = require('alljson');
let request = require("request");
let cheerio = require("cheerio");

let ANDROID_TYPE = "android";
let IOS_TYPE = "ios";

let CONFIG_FILE = path.join(__dirname, 'config.json');
let DB_FILE = path.join(__dirname, 'db.json');

let main = () => {

  let config = aj.readAllJSON( CONFIG_FILE );
  let db = aj.readAllJSON( DB_FILE );

  config.apps.forEach( (app) => {

    if (app.type === ANDROID_TYPE) {

      getHtml( googlePlayReviewsUrl(app.appId), ($) => {
          let reviews = tryTransform(app, transformGooglePlayReviews, $ );
          postLatestReviews(app, reviews);
      });

    } else if (app.type === IOS_TYPE) {

      getJson( appStoreReviewsUrl(app.appCountry, app.appId), (json) => {
          let reviews = tryTransform(app, transformAppStoreReviews, json );
          postLatestReviews(app, reviews);
      });

    }
  });

  let postLatestReviews = (app,reviews) => {

    let oldTimestamp = firstTruthy( db[app.name], 0 );

    let latest = latestReviews( reviews, oldTimestamp );
    let theLatestTimestamp = latest[0];
    let theLastestReviews = latest[1];

    console.log( "Posting %d new reviews for %j", theLastestReviews.length, app );

    postReviews( config.slackWebhookUrl, app, theLastestReviews );

    db[app.name] = Math.max( theLatestTimestamp, oldTimestamp );

    aj.saveAllJSON( DB_FILE, db );
  };
};

let postReviews = (slackWebhookUrl, app, reviews) => {

  if (!reviews || reviews.length === 0) {
    return;
  }

  let attachments = reviews.map( (r) => {
    return { text: [r.author, r.date, r.rating, r.title, r.desc].join("\n") };
  });

  let payload = {
    username: "slap-reviews",
    icon_emoji: ":iphone:",
    text: "New " + app.name + " reviews!",
    attachments: attachments
  };

  request.post(slackWebhookUrl).form({ payload: JSON.stringify(payload) });
};

let latestReviews = (reviews, timestamp) => {

  let latestReviews = reviews.filter( review => review.timestamp > timestamp );

  let latestTimestamp = latestReviews.length > 0 ? latestReviews[0].timestamp : 0;

  return [firstTruthy( latestTimestamp, 0 ), latestReviews];
}

let tryTransform = ( app, transform, value ) => {

  try {
    return transform(value);
  } catch( e ) {
    console.error( "Error while transforming %j", app );
    console.error(e.stack);
    process.exitCode = 1;
    return [];
  }
}

let googlePlayReviewsUrl = (androidAppId) => {
  return "https://play.google.com/store/apps/details?id=" + androidAppId
}

let transformGooglePlayReviews = ($) => {

  let reviews = $(".single-review").map( (i,e) => {

    let author = $(".author-name", e).text().trim();
    let date = $(".review-date", e).text().trim();
    let rating = $(".review-info-star-rating", e).find("[aria-label]").attr("aria-label").trim();
    let title = $(".review-title", e).text().trim();
    let desc = $(".review-body", e).contents().get(2).data.trim();

    let timestamp = firstTruthy( (new Date(date)).getTime(), 0 );

    return {
      author: author,
      date: date,
      timestamp: timestamp,
      rating: rating,
      title: title,
      desc: desc
    };
  }).toArray();

  reviews.sort( (r1, r2) => r2.timestamp - r1.timestamp );

  return reviews;
}

let appStoreReviewsUrl = (iosAppCountry, iosAppId) => {
  return "https://itunes.apple.com/" + iosAppCountry + "/rss/customerreviews/id=" + iosAppId + "/sortBy=mostRecent/json"
}

let transformAppStoreReviews = (json) => {

  return json.feed.entry.slice(1).map( (entry) => {

    let author = entry.author.name.label;
    let date = undefined;
    let rating = entry["im:rating"].label;
    let title = entry.title.label;
    let desc = entry.content.label;

    let timestamp = parseInt( entry.id.label, 10 );

    return {
      author: author,
      date: date,
      timestamp: timestamp,
      rating: rating,
      title: title,
      desc: desc
    };
  });
};

let get = (url,cb) => {

  request(url, function (error, response, body) {

    if (error) {
      console.log("error: " + error);
      return;
    }

    cb(body);
  });
};

let getHtml = (url,cb) => {

  let cbBody = (body) => {
      let $ = cheerio.load(body);
      cb($);
  };

  get(url, cbBody);
};

let getJson = (url,cb) => {

  let cbBody = (body) => {
      let json = JSON.parse(body);
      cb(json);
  };

  get(url, cbBody);
}

let firstTruthy = (a,b) => a ? a : b;

main();
