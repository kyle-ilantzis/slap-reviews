"use strict";

let fs = require('fs');

let request = require("request");
let cheerio = require("cheerio");

let main = () => {

  let config = readAllJSON('config.json');
  let db = readAllJSON('db.json');

  var androidReviews;
  var iosReviews;

  let join = () => {
    if (!androidReviews || !iosReviews) {
      return;
    }

    // console.log(androidReviews);
    // console.log(iosReviews);

    let oldAndroidTimestamp = firstTruthy( db.androidTimestamp, 0 );
    let oldIosTimestamp = firstTruthy( db.iosTimestamp, 0 );

    let androidLatest = latestReviews( androidReviews, oldAndroidTimestamp );
    let androidTimestamp = androidLatest[0];
    let lastestAndroidReviews = androidLatest[1];

    let iosLatest = latestReviews( iosReviews, oldIosTimestamp );
    let iosTimestamp = iosLatest[0];
    let lastestIosReviews = iosLatest[1];

    postReviews( config.slackWebhookUrl, "android", lastestAndroidReviews );
    postReviews( config.slackWebhookUrl, "ios", lastestIosReviews );

    db.androidTimestamp = Math.max( androidTimestamp, oldAndroidTimestamp );
    db.iosTimestamp = Math.max( iosTimestamp, oldIosTimestamp );

    saveAllJSON( 'db.json', db );
  };

  getHtml( googlePlayReviewsUrl(config.androidAppId), ($) => {
      androidReviews = transformGooglePlayReviews( $ );
      join();
  });

  getJson( appStoreReviewsUrl(config.iosAppCountry, config.iosAppId), (json) => {
      iosReviews = transformAppStoreReviews(json);
      join();
  });
}

let postReviews = (slackWebhookUrl, type, reviews) => {

  if (!reviews || reviews.length == 0) {
    return;
  }

  let attachments = reviews.map( (r) => {
    return { text: [r.author, r.date, r.rating, r.title, r.desc].join("\n") };
  });

  let payload = {
    text: "New " + type + " reviews!",
    attachments: attachments
  };

  console.log(payload);

  request.post(slackWebhookUrl).form({ payload: JSON.stringify(payload) });
};

let latestReviews = (reviews, timestamp) => {

  let latestReviews = reviews.filter( review => review.timestamp > timestamp );

  let latestTimestamp = latestReviews.length > 0 ? latestReviews[0].timestamp : 0;

  return [firstTruthy( latestTimestamp, 0 ), latestReviews];
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
  // TODO
  return [];
}

let readAllJSON = (file) => {
  var read = !fs.existsSync(file) ? null : fs.readFileSync(file, {encoding: 'utf8'});
  return read === null ? {} : JSON.parse( read );
};

let saveAllJSON = (file,json) => {
  fs.writeFileSync(file,JSON.stringify(json));
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
