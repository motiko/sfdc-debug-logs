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
        return '<div class="c">' +  curLine + '</div>';
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
document.getElementsByTagName('pre')[0].innerHTML = '<div class="hll">' + res + '</div>';
document.getElementsByClassName('oLeft')[0].style.display ="none";
var userDebugDivs = document.getElementsByClassName('debug');
for(var index=0; index < userDebugDivs.length; index++){
    //if(userDebugDivs[index].innderHTML.indexOf('BEAUTIFY') > -1)
    userDebugDivs[index].innerHTML = js_beautify(userDebugDivs[index].innerHTML);
}
console.log(document.getElementsByClassName('debug')[0].innerHTML )//= js_beautify(document.getElementsByClassName('debug')[0].innerHTML);

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
};
