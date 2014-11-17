var showSystemLabel = document.createElement('label');
showSystemLabel.innerHTML = '<input type="checkbox" name="checkbox" value="value" id="showSystem" >Show System Methods</label>';
var codeElement = document.getElementsByTagName('pre')[0];
codeElement.style.fontSize = '1.8em';
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

document.getElementsByClassName('codeBlock')[0].insertBefore(showSystemLabel,document.getElementById('debugText'));
var showsystem = document.getElementById('showSystem');
showSystem.onchange = function(event){
    var systemLogs = document.getElementsByClassName('systemMethodLog');
    systemLogs.forEach(function(systemLog){
        systemLog.style.display = this.checked ? 'block' : 'none';
    });
}

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

function expandUserDebug(e){
    var debugNode = this.nextElementSibling.nextElementSibling;
    var  oldVal =  debugNode.innerHTML;
    debugNode.innerHTML = js_beautify(sfdcObjectBeautify(debugNode.innerHTML));
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


