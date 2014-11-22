(function(){

var selectedText,currentResult,maxResult;

document.body.addEventListener('keyup',keyUpListener);

function keyUpListener(event){
    console.log(maxResult);
    console.log(currentResult);
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

document.body.addEventListener('mouseup',function(event){
    if(event.button == 2){
        return;
    }
    selectedText = document.getSelection().toString();
    [].slice.call(document.querySelectorAll('.highlightSearchResult') ).forEach(function(span){
        var highlightedText = span.innerText;
        var textNode = document.createTextNode(highlightedText);
        span.parentElement.insertBefore(textNode,span);
        span.parentElement.removeChild(span);
    });
    [].slice.call(document.querySelectorAll('.searchResultAnchor') ).forEach(function(a){
        a.parentElement.removeChild(a);
    });
    if(!selectedText){
        currentResult = 0;
        maxResult = 0;
        return;
    }
    selectedText = escapeHtml(selectedText);
    var searchableElements = [].slice.call(document.querySelectorAll('#debugText .searchable') );
    var resultNum = 0;
    searchableElements.filter(conatins(selectedText)).forEach(function(div){
        var regExp = new RegExp(escapeRegExp(selectedText),'gi');
        div.innerHTML = div.innerHTML.replace(regExp,function(match){
            var resultString = '<a name="result' + resultNum
            + '" class="searchResultAnchor" data-number="'
            + resultNum + '"></a><span class="highlightSearchResult" data-number="' + resultNum + '">'
            + match +'</span>';
            resultNum++;
            return resultString;
        });
        maxResult = resultNum-1;
    });
    var visibleSearchResults =  [].slice.call(document.querySelectorAll('.searchResultAnchor'))
                                .filter(function(anchor){
                                    return anchor.getBoundingClientRect().top >= 0;
                                });
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
});

function conatins(searchString){
    return function(nodeElem){
        return nodeElem.innerHTML.indexOf(searchString) > -1;
    }
}

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

var sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
var keyPrefixes = [];

var idRegex = /\b[a-zA-Z0-9]{18}\b|\b[a-zA-Z0-9]{15}\b/g;
var codeElement = document.querySelector('pre');
var debugText = escapeHtml(codeElement.innerText);

var res = debugText.split('\n').map(function(curLine){
    var splitedDebugLine = curLine.split('|');
    if(curLine.indexOf('Execute Anonymous:') == 0){
        return '<div class="system searchable">' + curLine + '</div>';
    }
    if(!splitedDebugLine || splitedDebugLine.length <= 1){
        return curLine;
    }

    curLine = curLine.replace(idRegex,'<a href="/$&" class="idLink">$&</a>');
    if(curLine.indexOf('|USER_DEBUG') > -1){
        return '<div class="debug">' +  curLine + '</div>';
    }
    if(curLine.indexOf('|SYSTEM_') > -1){
        return '<div class="system systemMethodLog searchable">' +  curLine + '</div>';
    }
    if(curLine.indexOf('|SOQL_EXECUTE_') > -1){
        return '<div class="soql searchable">' +  curLine + '</div>';
    }if(curLine.indexOf('METHOD_') > -1){
        return '<div class="method methodLog searchable">' +  curLine + '</div>';
    }if(curLine.indexOf('EXCEPTION') > -1){
        return '<div class="err searchable">' +  curLine + '</div>';
    }if(curLine.indexOf('|CODE_UNIT') > -1){
        return '<div class="method searchable">' +  curLine + '</div>';
    }if(curLine.indexOf('|CALLOUT') > -1){
        return '<div class="callout searchable">' +  curLine + '</div>';
    }
    return '<div class="rest searchable">' + curLine +'</div>';
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
    userDebugDiv.innerHTML = '<span class="debugHeader searchable">' +
            debugParts[0] + '|DEBUG| </span> <div class="debugContent searchable">' +
            debugParts[1] + '</div>';
    var buttonExpand = document.createElement('button');
    buttonExpand.onclick = expandUserDebug;
    buttonExpand.onmouseup = haltEvent;
    buttonExpand.innerText = '+'
    userDebugDiv.insertBefore(buttonExpand,userDebugDiv.children[0]);
});

function haltEvent(event){
    event.stopPropagation();
}

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
    xhr.onload = function(event){
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
    dropDown.onchange = function(event){
        document.querySelector('#debugText').className = this.value;
        localStorage.setItem('style',this.value);
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
    return function(event){
        var systemLogs =[].slice.call(document.getElementsByClassName(className)) ;
        systemLogs.forEach(function(systemLog){
            systemLog.style.display = event.srcElement.checked ? 'block' : 'none';
        });
    }
}

function expandUserDebug(event){
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
    this.onclick = function(event){
        debugNode.innerHTML = oldVal;
        this.innerText = '+';
        this.onclick = expandUserDebug;
        this.onmouseup = haltEvent;
    }
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

function sfdcObjectBeautify(string){
    var regex = /\w+:{(\w+=.+,?\s*)+}/;
    if(string.match(regex)){
        return string.replace(/([{| ]\w+)=(.+?)(?=, |},|}\))/g,function(match,p1,p2){
            return p1 + ':' + p2;
        });
    }
    return string;
}

})();