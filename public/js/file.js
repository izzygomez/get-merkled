$(document).ready(function() {

  sjcl.beware["CBC mode is dangerous because it doesn't protect message integrity."]();

  function F(key, plaintext) {
    var key_hash_bit = sjcl.hash.sha256.hash(key);
    var key_hash = sjcl.codec.hex.fromBits(key_hash_bit);

    var ctxt_bit = sjcl.hash.sha256.hash(plaintext);
    var ctxt = sjcl.codec.hex.fromBits(ctxt_bit);

    var final_ctxt_bit = sjcl.hash.sha256.hash(ctxt + key_hash);
    var final_ctxt = sjcl.codec.hex.fromBits(final_ctxt_bit);
    return final_ctxt;
  };

  function encrypt(key, iv, plaintext) {
    var key_bit = sjcl.codec.utf8String.toBits(key);
    var iv_bit = sjcl.codec.utf8String.toBits(iv);
    var ptxt_bit = sjcl.codec.utf8String.toBits(plaintext);

    var adata = [];
    var prp = new sjcl.cipher.aes(key_bit);
    var ciphertext = sjcl.mode.cbc.encrypt(prp, ptxt_bit, iv_bit, adata);

    var actual_ctxt = sjcl.codec.base64.fromBits(ciphertext);
    console.log(actual_ctxt);

    return actual_ctxt;
  };

  function decrypt(key, iv, ciphertext) {
    var key_bit = sjcl.codec.utf8String.toBits(key);
    var iv_bit = sjcl.codec.utf8String.toBits(iv);

    var ctxt_bit = sjcl.codec.base64.toBits(ciphertext);

    var adata = [];
    var prp = new sjcl.cipher.aes(key_bit);
    var plaintext = sjcl.mode.cbc.decrypt(prp, ctxt_bit, iv_bit, adata);

    var actual_plaintext = sjcl.codec.utf8String.fromBits(plaintext);
    return actual_plaintext;
  };

  function round1() {
    var queryString = $('#query').val();
    var filename = $('#filename').html();

    var keyString = $('#key').val();

    if (keyString.length != 272) {
      $('#message').html('Error: The key you entered is invalid.');
      return;
    }

    K_1 = keyString.substring(0,32);
    K_2 = keyString.substring(32,64);
    IV_s = 'This is an IV000';

    var T = [ F(K_1, '') ];
    for (var i = 0; i < queryString.length; i++) {
      var key = F(K_2, queryString.substring(0, i + 1)).substring(0, 32);
      var ctxt = F(K_1, queryString.substring(0, i + 1));
      T.push(encrypt(key, IV_s, ctxt));
    }

    console.log(T);
    console.log(queryString);
    console.log(filename);
    console.log('hi');
    $.ajax({
      url: '/file/' + filename + '/query/1',
      type: 'POST',
      data: {
        T: T
      },
      success: function(data) {
        var success = data.success;
        var message = data.message;
        if (success) {
          var found = data.found;
          if (found) {
            console.log('success!');
            console.log(message);
            $('#message').html(message);
            round2(data.encryptedTuple);
          } else {
            $('#message').html(message);
          }
        } else {
          $('#message').html(message);
        }
      },
      error: function(xhr, status, error) {
        console.log('oh noo');
      }
    });
  };

  function round2(encryptedTuple) {
    console.log('round 2 of communication protocol');

    var keyString = $('#key').val();
    K_D = keyString.substring(128,160);
    IV_s = 'This is an IV000';
    IV_D = keyString.substring(224,240);

    var filename = $('#filename').html();

    var queryString = $('#query').val();
    var length = queryString.length;

    var decryptedTuple = decrypt(K_D, IV_D, encryptedTuple);
    var values = decryptedTuple.split('---');
    var startIndex = values[0];
    var leafPos = values[1];
    var numLeaves = values[2];

    console.log('startIndex: ' + startIndex);
    console.log('leafPos: ' + leafPos);
    console.log('numLeaves: ' + numLeaves);

    $.ajax({
      url: '/file/' + filename + '/query/2',
      type: 'POST',
      data: {
        startIndex: startIndex,
        length: length,
        leafPos: leafPos,
        numLeaves: numLeaves
      },
      success: function(data) {
        var success = data.success;
        var message = data.message;
        if (success) {
          var C = data.C;
          var subL = data.subL;
          console.log('success!');
          console.log(message);
          console.log("C: ", C);
          console.log("subL:", subL);
          $('#message').html(message);
          round3(C, data.index, data.subL);
        } else {
          console.log("no success RIP");
          $('#message').html(message);
        }
      },
      error: function(xhr, status, error) {
        console.log('oh noo');
      }
    });
  };

  function round3(C, index, subL) {
    console.log('check whether strings match');

    var keyString = $('#key').val();
    K_C = keyString.substring(160,192);
    K_L = keyString.substring(192,224);
    IV_s = 'This is an IV000';
    IV_C = keyString.substring(240,256);
    IV_L = keyString.substring(256,272);

    var queryString = $('#query').val();
    var length = queryString.length;

    var decryptedC = '';
    for (var i = 0; i < length; ++i) {
      decryptedC += decrypt(K_C, IV_C, C[i]);
    }
    console.log('queryString: \'' + queryString + "\'");
    console.log('decryptedC: \'' + decryptedC + "\'");
    if (queryString == decryptedC) {
      console.log('strings match :D');

      var decryptedIndices = ""; //If the first one matches, then all match.

      for (var i = 0; i < subL.length; i++) {
        //Decrypt all possible indices and send the response back
        var currentIndex = decrypt(K_L, IV_L, subL[i]);
        decryptedIndices = decryptedIndices.concat(currentIndex + ", ");

      }

      decryptedIndices = decryptedIndices.slice(0,-2); // eww, trailing commas

      $('#message').html('found at indices: ' + decryptedIndices);
    } else {
      console.log('strings do not match');
      $('#message').html('did not find substring');
    }
  };

  $('#submit').click(round1);
});
