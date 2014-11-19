// ==UserScript==
// @name         Beautify Salesforce Debug View
// @namespace    SFDC
// @version      0.1
// @description
// @author       Moti
// @match        https://*.salesforce.com/p/setup/layout/ApexDebugLogDetailEdit/*
// @grant        none
// @require file:///c:/sfdc-debug-logs/monkey/beautify.js
// @require file:///c:/sfdc-debug-logs/monkey/sfdc.debug.js
// @resource debug_css file:///c:/sfdc-debug-logs/monkey/debug.css
// @grant    GM_addStyle
// @grant    GM_getResourceText
// @run-at document-end
// ==/UserScript==
(function(){

// Monkey only
var debug_css = GM_getResourceText ("debug_css");
GM_addStyle (debug_css);
//

var sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
var keyPrefixes = [];

var idRegex = /\b[a-zA-Z0-9]{18}\b|\b[a-zA-Z0-9]{15}\b/g;
var codeElement = document.querySelector('pre');
var debugText = codeElement.innerText;

var res = debugText.split('\n').map(function(curLine){
    var splitedDebugLine = curLine.split('|');
    if(curLine.indexOf('Execute Anonymous:') == 0){
        return '<div class="system">' + curLine + '</div>';
    }
    if(!splitedDebugLine || splitedDebugLine.length <= 1){
        return escapeHtml(curLine);
    }

    curLine = curLine.replace(idRegex,'<a href="/$&" class="idLink">$&</a>');
    if(curLine.indexOf('|USER_DEBUG') > -1){
        return '<div class="debug">' +  curLine + '</div>';
    }
    if(curLine.indexOf('|SYSTEM_') > -1){
        return '<div class="system systemMethodLog">' +  curLine + '</div>';
    }
    if(curLine.indexOf('|SOQL_EXECUTE_') > -1){
        return '<div class="soql">' +  curLine + '</div>';
    }if(curLine.indexOf('METHOD_') > -1){
        return '<div class="method methodLog">' +  curLine + '</div>';
    }if(curLine.indexOf('EXCEPTION') > -1){
        return '<div class="err">' +  curLine + '</div>';
    }if(curLine.indexOf('|CODE_UNIT') > -1){
        return '<div class="method">' +  curLine + '</div>';
    }if(curLine.indexOf('|CALLOUT') > -1){
        return '<div class="callout">' +  curLine + '</div>';
    }
    return '<div class="rest">' + curLine +'</div>';
}).reduce(function(prevVal,curLine,index,arr){
    if(index == 1){
        return '<div class="rest">' + prevVal + '</div>' + curLine ;
    }
    if(curLine.lastIndexOf('</div>') ==  curLine.length - '</div>'.length){
        return prevVal + curLine;
    }
    return prevVal.substr(0,prevVal.length - '</div>'.length) + '\n' + curLine + '</div>';
});

var codeBlock = document.querySelector('pre');
codeBlock.innerHTML = '<div class="monokai" id="debugText">' + res + '</div>';
document.querySelector('.oLeft').style.display ="none";
var oRight = document.querySelector('.oRight');
oRight.insertBefore(codeBlock,oRight.firstChild);
addCheckboxes();
addDropDown();
removeIllegalIdLinks();
var userDebugDivs = [].slice.call(document.getElementsByClassName('debug'));

userDebugDivs.forEach(function(userDebugDiv){
    var debugParts = userDebugDiv.innerHTML.split('|DEBUG|');
    userDebugDiv.innerHTML = '<span class="header">' +
            debugParts[0] + '|DEBUG| </span> <div class="content">' +
            debugParts[1] + '</div>';
    var buttonExpand = document.createElement('button');
    buttonExpand.onclick = expandUserDebug;
    buttonExpand.innerText = '+'
    userDebugDiv.insertBefore(buttonExpand,userDebugDiv.children[0]);
});

function idToLinks(separator){
    return function (sum,word){
        if(/^[a-zA-Z0-9]*$/.test(word) && ( word.length == 15 || word.length == 18 ) ){
            return sum + separator + '<a href="/' + word + '">' +  word + '</a>';
        }
        return sum + separator + word;
    }
}

function removeIllegalIdLinks(){
    var xhr = new XMLHttpRequest();
    xhr.open('GET','/services/data/v29.0/sobjects');
    xhr.onload = function(e){
        var sobjects = JSON.parse(this.responseText).sobjects;
        keyPrefixes = sobjects.filter(function(sobj){
            return (sobj.keyPrefix != undefined);
        }).map(function(sobjectDescribe){
            return sobjectDescribe.keyPrefix;
        });
        var idLinks = document.getElementsByClassName('idLink');
        [].slice.call(idLinks).forEach(function(link){
            if(!isLegalId(link.innerText)){
                link.className = 'disableClick';
            }
        });
    }
    xhr.setRequestHeader('Authorization','Bearer ' + sid);
    xhr.send();
}

function isLegalId(id){
    return ( keyPrefixes.indexOf( id.substr(0,3) ) > -1 );
}

function addDropDown(){
    var dropDown = document.createElement('select');
    var styles = [{name:'monokai',label:'Monokai'},{name:'bw',label:'Black/White'},{name:'emacs',label:'Emacs'}];
    styles.forEach(function(style){
        var opt = document.createElement('option');
        opt.value = style.name;
        opt.innerText = style.label;
        dropDown.appendChild(opt);
    });
    dropDown.onchange = function(e){
        document.querySelector('#debugText').className = this.value;
        localStorage.setItem('style',this.value);
        //debugger;
    }
    document.querySelector('.codeBlock').insertBefore(dropDown,document.getElementById('debugText'));
    var savedStyle = localStorage.getItem('style');
    if(savedStyle){
        dropDown.value = savedStyle;
        dropDown.onchange();
    }
}

function addCheckboxes(){
    var showSystemLabel = document.createElement('label');
    showSystemLabel.className = 'toggleHidden';
    showSystemLabel.innerHTML = '<input type="checkbox" name="checkbox" id="showSystem" />Show System Methods</label>';
    var showMethodLog = document.createElement('label');
    showMethodLog.className = 'toggleHidden';
    showMethodLog.innerHTML = '<input type="checkbox" name="checkbox" checked="checked" id="showUserMethod"  />Show User Methods</label>';
    document.querySelector('.codeBlock').insertBefore(showMethodLog,document.getElementById('debugText'));
    document.querySelector('.codeBlock').insertBefore(showSystemLabel,document.getElementById('debugText'));
    var showUser = document.getElementById('showUserMethod');
    showUser.onchange = toogleHidden('methodLog');
    var showsystem = document.getElementById('showSystem');
    showSystem.onchange = toogleHidden('systemMethodLog');
}

function toogleHidden(className){
    return function(e){
        var systemLogs =[].slice.call(document.getElementsByClassName(className)) ;
        systemLogs.forEach(function(systemLog){
            systemLog.style.display = e.srcElement.checked ? 'block' : 'none';
        });
    }
}

function expandUserDebug(e){
    var debugNode = this.nextElementSibling.nextElementSibling;
    var  oldVal =  debugNode.innerHTML;
    debugNode.innerHTML = js_beautify(sfdcObjectBeautify(debugNode.innerText));
    debugNode.innerHTML = debugNode.innerHTML.replace(idRegex,function(id){
        if(isLegalId(id)){
            return '<a href="/' + id + '" class="idLink">' + id + '</a>';
        }
        else{
            return id;
        }
    });
    this.innerText = '-';
    this.onclick = function(e){
        debugNode.innerHTML = oldVal;
        this.innerText = '+';
        this.onclick = expandUserDebug;
    }
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
};

function sfdcObjectBeautify(string){
    var regex = /\w+:{(\w+=.+,?\s*)+}/;
    if(string.match(regex)){
        return string.replace(/(\w+)=(.+?)(?=, |},|}\))/g,function(match,p1,p2){
            return p1 + ':' + p2;
        });
    }
    return string;
}

})();