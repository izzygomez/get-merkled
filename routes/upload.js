var express = require('express');
var multer = require('multer');
var fs = require('fs');
var readline = require('readline');
var schemas = require('../models/schemas');
var router = express.Router();

var User = schemas.User;
var File = schemas.File;

var uploads_dir = './uploads';

var authenticate = function(req, res, next) {
  if (req.session.currentUser) {
    next();
  } else {
    res.render('index', { message: 'Please log in!' });
  }
};

router.all('*', authenticate);

/* GET upload page. */
router.get('/', function(req, res, next) {
  var user = req.session.currentUser;
  var message = 'Logged in as: ' + user.username;
  res.render('upload', { user: true, message: message });
});

/* POST upload page. */
router.post('/', function(req, res, next) {
  var user = req.session.currentUser;
  var dir = uploads_dir + '/' + user.username;
  var storage = multer.diskStorage({
    destination: function(req, file, callback) {
      if (!fs.existsSync(uploads_dir)) {
        fs.mkdirSync(uploads_dir);
      }
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      callback(null, dir);
    },
    filename: function (req, file, callback) {
      callback(null, file.originalname);
    }
  });

  var upload = multer({ storage: storage }).single('ciphertextFile');
  upload(req, res, function(err) {
    if (err) {
      res.render('upload', { user: true, message: 'Error uploading file.' });
    } else {
      User.findOne({ 'username': user.username }, function(err, currentuser){
        if (err) { 
          res.render('upload', { user: true, message: 'Error uploading file. Username not found.' });
        } else {
          if (currentuser.files.indexOf(req.file.originalname) > -1) {
            res.render('upload', { user: true, message: 'You may not upload files with duplicate filenames!' });
          } else {
            var state = -1; // -1: starting D, 0: D, 1: C
            var totalD = -1;
            var totalC = -1;
            var nD = 0;
            var nC = 0;

            var D = {};
            var C = [];

            var lineReader = readline.createInterface({
              terminal: false,
              input: fs.createReadStream(req.file.path)
            });
            console.log("about to go into line reader!");
            lineReader.on('line', function(line) {
              if (state === -1) {
                totalD = Number(line);
                state = 0;
              } else if (state === 0) {
                if (nD < totalD) {
                  json = JSON.parse(line);
                  for (var key in json) {
                    if (json.hasOwnProperty(key)) {
                      D[key] = json[key];
                    }
                  }
                  ++nD;
                } else {
                  totalC = Number(line);
                  state = 1;
                }
              } else if (state == 1) {
                if (nC < totalC - 1) {
                  C.push(line);
                  ++nC;
                } else {
                  C.push(line);
                  // for (var key in D) {
                  //   if (D.hasOwnProperty(key)) {
                  //     console.log(key + ' -> ' + D[key]);
                  //   }
                  // }
                  // for (var i = 0; i < C.length; ++i) {
                  //   console.log(C[i]);
                  // }
                  // console.log(Object.keys(D).length)
                  // console.log(C.length);
                  User.update({ 'username': user.username },
                              { $push: { 'files': req.file.originalname } },
                              function(err) {
                    if (err) {
                      res.render('upload', { user: true, message: 'An error occured!' });
                    } else {
                      var new_file = new File({
                        'filename': req.file.originalname,
                        'username': user.username,
                        'D': D,
                        'C': C
                      });
                      new_file.save();
                      res.render('upload', { user: true, message: 'Upload successful!' });
                    }
                  });
                }
              } else {
                console.log('ERROR');
              }
            });
          }
        }
      });
    }
  });
});


module.exports = router;
