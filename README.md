# SF Library Hold Notifs

Reading books is great. Reading books for free is even greater. The SF library allows you to check out books through your kindle. Unfortunately, the wait time on ebooks can take a pretty long time - up to 2 months.

The trick is to put a ton of books on hold at once, so you always have a queue of books waiting for you. A nice feature of the library is that you can pause your place in line. So if you just started a book, and you are first in line for another book, you can pause your place in line. Once you finish your current book, you can resume your place in line on the other book.

The problem with this is that this requires frequent checks of the library website so you can pause your place in line at the right time.

I don't want to do that. This repo solves the problem by giving you a weekly summary email of all your books on hold. Further, it notifies you whenever you have 5 or less people in front of you for a particular hold and have moved up in line.

## Getting Started

This package uses node 8.11.1, aws lambda, and aws cloudwatch (for scheduling events).

### Dependencies

This repo uses the following packages:
* cheerio - parsing html in node
* firebase - saving user hold information
* mailgun - sending email
* moment - date formatting

### Prerequisites

This package assumes you have the following accounts:
firebase, mailgun, sf library (obviously), and aws.

### Installing

Install the packages:

```
yarn
```

### Running locally

In `index.js`, comment out this line
```
exports.handler = go;
```
And uncomment in this line
```
go();
```
Then fill out `secrets.json`. (See `secrets-example.json` for correct structure of the secrets file). Then run

```
node index.js
```

### Deploying to lambda

First, zip this folder. In this repo, run

```
zip -r ../sf-library-hold-notifs.zip *
```

Then upload that to lambda. Note: this repo is too large for a direct upload to lambda, so you need to upload it to s3 first, then have lambda read it from s3.

In cloudwatch, create a scheduled event for running this every day.

