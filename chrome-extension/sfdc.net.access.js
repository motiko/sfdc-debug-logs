(function(){

var sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2],
    pendingIps = [],
    IP_RANGE = 255,
    counterElement = document.createElement('p');



addButton();
initCounterElement();

function initCounterElement(){
    counterElement.innerText = '0/' + IP_RANGE;
    counterElement.id = 'ipCounter';
}
function addButton(){
    var pbButton = document.querySelector('.pbButton');
    var allowAllButton = document.createElement('input');
    allowAllButton.type = 'button';
    allowAllButton.className = 'btn';
    allowAllButton.value = 'Allow All Ranges (!)';
    allowAllButton.onclick = allowAll;
    if(pbButton) pbButton.appendChild(allowAllButton);
}

function createLoadingImage(){
    var loadingImage = document.createElement('img');
    loadingImage.src = '/img/loading.gif';
    loadingImage.className = 'LoadinImage';
    return loadingImage;
}





function allowAll(){
    var pbButton = document.querySelector('.pbButton');
    if(confirm('This will allow users to connect from every computer without verification code or security token. This might present a security threat. Would you like to proceed?')){
        if(pbButton){
            pbButton.appendChild(createLoadingImage());
            pbButton.appendChild(counterElement);
        }
        for(var i = 0 ; i <= IP_RANGE ;i+=2){
            addIp(i);
        }
    }
}
function addIp(ipPrefix){
    pendingIps[ipPrefix] = true;
    request('/05G/e','get').then(function(result){
        var confirmationToken = result.match(/input type="hidden" name="_CONFIRMATIONTOKEN" id="_CONFIRMATIONTOKEN" value="([^"]*)"/)[1];
        return request('/05G/e?IpStartAddress=' + ipPrefix + '.0.0.0&IpEndAddress=' + (ipPrefix + 1) + '.255.255.255&save=1&_CONFIRMATIONTOKEN=' + confirmationToken,'post');
    }).then(function(result){
        console.log(ipPrefix + ' is done');
        pendingIps[ipPrefix] = false;
        var ipsLeft = pendingIps.reduce(function(sum,curVal){
            return curVal ? ++sum : sum;
        },0);
        console.log(ipsLeft + ' ips left');
        counterElement.innerText = (IP_RANGE-ipsLeft) + '/' + IP_RANGE;
        if(ipsLeft === 0) location.reload();
    });
}

function request(url,method){
    method = method || 'GET';
    if(typeof GM_xmlhttpRequest === "function"){
        return new Promise(function(fulfill,reject){
            GM_xmlhttpRequest({
                method:method,
                url:url,
                headers:{
                    Authorization:'Bearer ' + sid,
                    Accept:'*/*'
                },
                onload:function(response){
                    if( response.status.toString().indexOf('2') === 0){
                        fulfill(response.response);
                    }else{
                        reject(Error(response.statusText));
                    }
                },
                onerror:function(response){
                    rejected(Error("Network Error"));
                }
            });
        });
    }
    return new Promise(function(fulfill,reject){
        var xhr = new XMLHttpRequest();
        xhr.open(method,url);
        xhr.onload = function(){
            if( xhr.status.toString().indexOf('2') === 0){
                fulfill(xhr.response);
            }else{
                reject(Error(xhr.statusText));
            }
        };
        xhr.onerror = function(){
            rejected(Error("Network Error"));
        };
        xhr.setRequestHeader('Authorization','Bearer ' + sid);
        xhr.send();
    });
}

})();