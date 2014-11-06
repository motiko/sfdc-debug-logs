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

var debug_css = GM_getResourceText ("debug_css");
GM_addStyle (debug_css);
var showSystemLabel = document.createElement('label');
showSystemLabel.innerHTML = '<input type="checkbox" name="checkbox" value="value" id="showSystem" >Show System Methods</label>';
var codeElement = document.getElementsByTagName('pre')[0];
var debugText = codeElement.innerText;
var res = debugText.split('\n').map(function(curLine){
    var splitedDebugLine = curLine.split('|');
    if(curLine.indexOf('Execute Anonymous:') == 0){
        return '<div class="c">' + curLine + '</div>';
    }
    if(!splitedDebugLine || splitedDebugLine.length <= 1){
        return escapeHtml(curLine);
    }
    if(curLine.indexOf('|USER_DEBUG') > -1){
        return '<div class="o debug">' +  curLine + '</div>';
    }
    if(curLine.indexOf('|SYSTEM_METHOD_') > -1){
        return '<div class="c systemMethodLog">' +  curLine + '</div>';
    }
    if(curLine.indexOf('|SOQL_EXECUTE_') > -1){
        return '<div class="l">' +  curLine + '</div>';
    }if(curLine.indexOf('METHOD_') > -1){
        return '<div class="k">' +  curLine + '</div>';
    }if(curLine.indexOf('EXCEPTION') > -1){
        return '<div class="err">' +  curLine + '</div>';
    }if(curLine.indexOf('|CODE_UNIT') > -1){
        return '<div class="sc">' +  curLine + '</div>';
    }if(curLine.indexOf('|CALLOUT') > -1){
        return '<div class="na">' +  curLine + '</div>';
    }
    return '<div class="nv">' + curLine +'</div>';
}).reduce(function(prevVal,curLine,index,arr){
    if(index == 1){
        return '<div class="p">' + prevVal + '</div>' + curLine ;
    }
    if(curLine.lastIndexOf('</div>') ==  curLine.length - '</div>'.length){
        return prevVal + curLine;
    }
    return prevVal.substr(0,prevVal.length - '</div>'.length) + '\n' + curLine + '</div>';

});
document.getElementsByTagName('pre')[0].innerHTML = '<div class="hll" id="debugText">' + res + '</div>';
document.getElementsByClassName('oLeft')[0].style.display ="none";
var userDebugDivs = document.getElementsByClassName('debug');
document.getElementsByClassName('codeBlock')[0].insertBefore(showSystemLabel,document.getElementById('debugText'));
var showsystem = document.getElementById('showSystem');
showSystem.onchange = function(event){
    var systemLogs = document.getElementsByClassName('systemMethodLog');
    for(var i =0; i < systemLogs.length;i++){
        systemLogs[i].style.display = this.checked ? 'block' : 'none';
    }
}
for(var index=0; index < userDebugDivs.length; index++){
    //if(userDebugDivs[index].innderHTML.indexOf('BEAUTIFY') > -1)
    if(userDebugDivs[index].innerHTML.indexOf('~^~') > -1){
        userDebugDivs[index].innerHTML = sfdcObjectBeautify(userDebugDivs[index].innerHTML);
    }
    //userDebugDivs[index].innerHTML = js_beautify(userDebugDivs[index].innerHTML);
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
};

function sfdcObjectBeautify(string){
    string = string.split('~^~').join('\n');

    return string.split('').reduce(function(prevSum,curChar,index,arr){
        if(curChar == '{'){
            return prevSum + '{"';
        }
        if(curChar == '}'){
            return prevSum + '"}';
        }
        if(curChar == ','){
            return prevSum + '","';
        }
        if(curChar == '='){
            return prevSum + '":"';
        }
        return prevSum + curChar;
    })
}
