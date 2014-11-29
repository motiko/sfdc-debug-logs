// ==UserScript==
// @name         Beautify Salesforce Debug View
// @namespace    SFDC
// @version      0.1
// @description
// @author       Moti
// @match        https://*.salesforce.com/p/setup/layout/ApexDebugLogDetailEdit/*
// @grant        none
// @require file:///c:/sfdc-debug-logs/monkey/beautify.js
// @require file:///c:/sfdc-debug-logs/monkey/beautify-html.js
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
var selectedText,
    currentResult,
    maxResult,
    keyPrefixes = [],
    sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2],
    idRegex = /\b[a-zA-Z0-9]{18}\b|\b[a-zA-Z0-9]{15}\b/g,
    logEntryToDivTagClass = [{
        logEntry: '|USER_DEBUG',
        divClass: 'debug'
    },
    {
        logEntry: '|SYSTEM_',
        divClass: 'system systemMethodLog searchable'
    },
    {
        logEntry: '|SOQL_EXECUTE_',
        divClass: 'soql searchable'
    },
    {
        logEntry: '|METHOD_',
        divClass: 'method methodLog searchable'
    },
    {
        logEntry: '|EXCEPTION_',
        divClass: 'err searchable'
    },
    {
        logEntry: '|CODE_UNIT',
        divClass: 'method searchable'
    },
    {
        logEntry: '|CALLOUT',
        divClass: 'callout searchable'
    },
    {
        logEntry: '|VALIDATION_',
        divClass: 'method searchable'
    },
        {
        logEntry: '|EXECUTION_',
        divClass: 'rest searchable'
    }
    ];

init();

function init(){
    document.body.addEventListener('keyup',keyUpListener);
    document.body.addEventListener('mouseup',searchSelectedText);
    var codeElement = document.querySelector('pre');
    var debugText = escapeHtml(codeElement.innerText);
    var res = debugText.split('\n').map(addTagsToKnownLines).reduce(toMultilineDivs);
    var codeBlock = document.querySelector('pre');
    codeBlock.innerHTML = '<div class="monokai" id="debugText">' + res + '</div>';
    document.querySelector('.oLeft').style.display ="none";
    var oRight = document.querySelector('.oRight');
    oRight.insertBefore(codeBlock,oRight.firstChild);
    addControllersContainer();
    addCheckboxes();
    addDropDown();
    if(!localStorage.getItem('dontShowSearchHint')){
        addSearchHint();
    }
    removeIllegalIdLinks();
    var userDebugDivs = toArray(document.getElementsByClassName('debug'));
    userDebugDivs.forEach(addExpnasionButtonsForUserDebugDivs);
    /*toArray(document.querySelectorAll('.expandUserDebugBtn')).forEach(function(button){
        button.onclick();
    });*/
    addCollapseAllButton();
}

function addControllersContainer(){
    var container = document.createElement('div');
    container.id = 'controllersContainer';
    addToTop(container);
}

function toArray(elemntList){
    return [].slice.call(elemntList);
}

function addSearchHint(){
    var hintContainer = document.createElement('span');
    hintContainer.id = 'hintContainer';
    var hint = document.createElement('span');
    hint.innerText = 'Tip: To quick search hold Alt key while selecting text (f - forward, b - back, esc - clear)';
    var hideTip = document.createElement('a');
    hideTip.innerText = 'X';
    hideTip.onclick = function(){
        hintContainer.style.display = 'none';
        localStorage.setItem('dontShowSearchHint',true);
    }
    hintContainer.appendChild(hideTip);
    hintContainer.appendChild(hint);
    addToTop(hintContainer);
}

function addDropDown(){
    var selectStyleContainer = document.createElement('span');
    selectStyleContainer.id = 'selectStyleContainer';
    var label = document.createElement('label');
    label.innerText = 'Pick Style: ';
    label.for = 'styleSelection';
    var dropDown = document.createElement('select');
    dropDown.id = 'styleSelection';
    var styles = [{name:'monokai',label:'Monokai'},{name:'bw',label:'Black/White'},{name:'emacs',label:'Emacs'}];
    styles.forEach(function(style){
        var opt = document.createElement('option');
        opt.value = style.name;
        opt.innerText = style.label;
        dropDown.appendChild(opt);
    });
    dropDown.onchange = function(event){
        document.querySelector('#debugText').className = this.value;
        localStorage.setItem('style',this.value);
    }
    selectStyleContainer.appendChild(label);
    selectStyleContainer.appendChild(dropDown);
    addController(selectStyleContainer);
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
    addController(showMethodLog);
    addController(showSystemLabel);
    var showUser = document.getElementById('showUserMethod');
    showUser.onchange = toogleHidden('methodLog');
    var showsystem = document.getElementById('showSystem');
    showSystem.onchange = toogleHidden('systemMethodLog');
}
/*
function addCheckboxes(){
    var showSystemContainer = document.createElement('span');
    showSystemContainer.className = 'checkBoxContainer';
    var showSystemLabel = document.createElement('label');
    showSystemLabel.className = 'toggleHidden';
    showSystemLabel.for = 'showSystem';
    showSystemLabel.innerText = 'Show System Methods';
    var showSystemCb = document.createElement('input');
    showSystemCb.type = 'checkbox';
    showSystemCb.id = 'showSystem';
    showSystemContainer.appendChild(showSystemCb);
    showSystemContainer.appendChild(showSystemLabel);
    var showUserContainer = document.createElement('span');
    showUserContainer.className = 'checkBoxContainer';
    var showUserLabel = document.createElement('label');
    showUserLabel.className = 'toggleHidden';
    showUserLabel.for = 'showUserMethod';
    showUserLabel.innerText = 'Show User Methods';
    var showUserCb = document.createElement('input');
    showUserCb.type = 'checkbox';
    showUserCb.id = 'showUserMethod';
    showUserCb.checked = 'checked';
    showUserContainer.appendChild(showUserCb);
    showUserContainer.appendChild(showUserLabel);
    addController(showUserContainer);
    addController(showSystemContainer);
    var showUser = document.getElementById('showUserMethod');
    showUser.onchange = toogleHidden('methodLog');
    var showsystem = document.getElementById('showSystem');
    showSystem.onchange = toogleHidden('systemMethodLog');
}*/

function addCollapseAllButton(){
    var button = document.createElement('button');
    button.innerText = 'Expand All';
    button.onclick = colapseAll;
    button.id = 'collapseAllButton';
    button.className = 'myButton';
    addToTop(button);
}

function colapseAll(){
    toArray(document.querySelectorAll('.expandUserDebugBtn.collapsed')).forEach(function(button){
        button.onclick();
    });
    this.innerText = 'Collapse All';
    this.onclick = function(){
        toArray(document.querySelectorAll('.expandUserDebugBtn.expanded')).forEach(function(button){
            button.onclick();
        });
        this.innerText = 'Expand All';
        this.onclick = colapseAll;
    }
}

function addToTop(nodeElement){
    document.querySelector('.codeBlock').insertBefore(nodeElement,document.getElementById('debugText'));
}

function addController(controller){
    document.querySelector('#controllersContainer').appendChild(controller);
}

function keyUpListener(event){
    if(event.keyCode  == 70){ // 'f'
        if(currentResult === undefined || currentResult === maxResult){
            currentResult = -1;
        }
        currentResult++;
        goToResult(currentResult);
    }
    if(event.keyCode  == 66){ // 'b'
        if(currentResult === undefined || currentResult === 0){
            currentResult = maxResult + 1;
        }
        currentResult--;
        goToResult(currentResult);
    }
    if(event.keyCode  == 27){ // 'esc'
        removeHighlightingOfSearchResults();
    }
}

function goToResult(resultNum){
    document.location.replace('#result' + resultNum);
    document.body.addEventListener('keyup',keyUpListener);
    var previouslySelectdElement = document.querySelector('.currentResult')
    if(previouslySelectdElement){
        previouslySelectdElement.classList.remove('currentResult');
    }
    document.querySelector('span.highlightSearchResult[data-number="' + resultNum + '"]')
            .classList.add('currentResult');
}

function removeHighlightingOfSearchResults(){
    currentResult = 0;
    maxResult = 0;
    toArray(document.querySelectorAll('.highlightSearchResult') ).forEach(function(span){
        var highlightedText = span.innerText;
        var textNode = document.createTextNode(highlightedText);
        span.parentElement.insertBefore(textNode,span);
        span.parentElement.removeChild(span);
    });
    toArray(document.querySelectorAll('.searchResultAnchor') ).forEach(function(a){
        a.parentElement.removeChild(a);
    });
}

function searchSelectedText(event){
    if(event.button == 2 || !event.altKey){
        return;
    }
    selectedText = document.getSelection().toString();
    removeHighlightingOfSearchResults();
    if(!selectedText){
        currentResult = 0;
        maxResult = 0;
        return;
    }
    selectedText = escapeHtml(selectedText);
    var searchableElements = toArray(document.querySelectorAll('#debugText .searchable') );
    var resultNum =0 ;
    searchableElements.filter(notHidden).filter(conatins(selectedText)).forEach(function(div){
        var regExp = new RegExp(escapeRegExp(selectedText),'gi');
        div.innerHTML = div.innerText.replace(regExp,function(match){
            var resultString = '<a name="result' + resultNum
            + '" class="searchResultAnchor" data-number="'
            + resultNum + '"></a><span class="highlightSearchResult" data-number="' + resultNum + '">'
            + match +'</span>';
            resultNum++;
            return resultString;
        });
        div.innerHTML = div.innerHTML.replace(idRegex,withLegalId);
        maxResult = resultNum-1;
    });
    markNearestSearchResult();
}

function notHidden(element){
    return element.offsetParent  !== null;
}

function markNearestSearchResult(){
    var visibleSearchResults =  toArray(document.querySelectorAll('.searchResultAnchor'))
                                .filter(isVisibleElement);
    if(visibleSearchResults.length > 0){
        var mouseY = event.clientY;
        var closest = visibleSearchResults.map(function(anchor){
            var anchorY = anchor.getBoundingClientRect().top;
            return {element: anchor,distance:Math.abs(mouseY - anchorY)};
        }).reduce(function(found,current){
            if(current.distance < found.distance){
                return current;
            }
            return found;
        });
        currentResult = parseInt(closest.element.dataset.number,10);
        document.querySelector('span.highlightSearchResult[data-number="' + currentResult + '"]')
            .classList.add('currentResult');
    }
}

function isVisibleElement(element){
    return element.getBoundingClientRect().top >= 0;
}

function highlightResults(resultNum){
    return
}

function addExpnasionButtonsForUserDebugDivs(userDebugDiv){
    var debugParts = userDebugDiv.innerHTML.split('|DEBUG|');
    userDebugDiv.innerHTML = '<span class="debugHeader searchable">' +
            debugParts[0] + '|DEBUG| </span> <div class="debugContent searchable">' +
            debugParts[1] + '</div>';
    var buttonExpand = document.createElement('button');
    buttonExpand.onclick = expandUserDebug;
    buttonExpand.onmouseup = haltEvent;
    buttonExpand.className = 'expandUserDebugBtn collapsed myButton';
    buttonExpand.innerText = '+';
    userDebugDiv.insertBefore(buttonExpand,userDebugDiv.children[0]);
}

function toMultilineDivs(prevVal,curLine,index){
    if(index == 1){ // handling first line
        return '<div class="rest">' + prevVal + '</div>' + curLine ;
    }
    else if(curLine.lastIndexOf('</div>') ==  curLine.length - '</div>'.length){ // current line ends with <div> tag all good
        return prevVal + curLine;
    }
    else{ // expanding <div> to mutliline (e.g. LIMIT_USAGE_FOR_NS is multiline and cant recognise each line separately)
        return prevVal.substr(0,prevVal.length - '</div>'.length) + '\n' + curLine + '</div>';
    }
}

function addTagsToKnownLines(curLine){
    if(curLine.indexOf('Execute Anonymous:') == 0){
        return '<div class="system searchable">' + curLine + '</div>';
    }
    curLine = curLine.replace(idRegex,'<a href="/$&" class="idLink">$&</a>');
    var resultTag = '';
    logEntryToDivTagClass.forEach(function(toClassMapping){
        if(curLine.indexOf(toClassMapping.logEntry) > -1){
            resultTag = '<div class="' + toClassMapping.divClass + '">' +  curLine + '</div>';
        }
    })
    if(resultTag){
        return resultTag;
    }
    var splitedDebugLine = curLine.split('|');
    if(!splitedDebugLine || splitedDebugLine.length <= 2){
        return curLine;
    }
    return '<div class="rest searchable">' + curLine +'</div>';
}

function haltEvent(event){
    event.stopPropagation();
}

function removeIllegalIdLinks(){
    var xhr = new XMLHttpRequest();
    xhr.open('GET','/services/data/v29.0/sobjects');
    xhr.onload = function(event){
        var sobjects = JSON.parse(this.responseText).sobjects;
        keyPrefixes = sobjects.filter(function(sobj){
            return (sobj.keyPrefix != undefined);
        }).map(function(sobjectDescribe){
            return sobjectDescribe.keyPrefix;
        });
        keyPrefixes.push('03d') // validation rule
        var idLinks = document.getElementsByClassName('idLink');
        toArray(idLinks).forEach(function(link){
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

function toogleHidden(className){
    return function(event){
        var systemLogs =toArray(document.getElementsByClassName(className)) ;
        systemLogs.forEach(function(systemLog){
            systemLog.style.display = event.srcElement.checked ? 'block' : 'none';
        });
    }
}

function expandUserDebug(event){
    var debugNode = this.nextElementSibling.nextElementSibling;
    var  oldVal =  debugNode.innerHTML;
    if(looks_like_html(debugNode.innerText)){
        debugNode.innerText = html_beautify(debugNode.innerText);
    }else{
        debugNode.innerText = js_beautify(sfdcObjectBeautify(debugNode.innerText));
    }
    debugNode.innerHTML = debugNode.innerHTML.replace(idRegex,withLegalId);
    this.innerText = '-';
    this.classList.add('expanded');
    this.classList.remove('collapsed');
    this.onclick = function(event){
        debugNode.innerHTML = oldVal;
        this.classList.remove('expanded');
        this.classList.add('collapsed');
        this.innerText = '+';
        this.onclick = expandUserDebug;
        this.onmouseup = haltEvent;
    }
}

function withLegalId(id){
    if(isLegalId(id)){
        return '<a href="/' + id + '" class="idLink">' + id + '</a>';
    }
    else{
        return id;
    }
}

function sfdcObjectBeautify(string){
    var regex = /\w+:{(\w+=.+,?\s*)+}/;
    if(string.match(regex)){
        return string.replace(/([{| ]\w+)=(.+?)(?=, |},|}\))/g,function(match,p1,p2){
            return p1 + ': \'' + p2 + '\'';
        });
    }
    return string;
}

function looks_like_html(source) {
    var trimmed = source.replace(/^[ \t\n\r]+/, '');
    return (trimmed && trimmed.substring(0, 1) === '<');
}

function escapeHtml(text) {
    var map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function conatins(searchString){
    return function(nodeElem){
        return nodeElem.innerHTML.indexOf(searchString) > -1;
    }
}

})();