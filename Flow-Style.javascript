<script type="text/javascript">
    setTimeout(function(){
        var cards = $('.flow-inner .category .card');
        console.log(cards);
        var intend = 0;
        var intendNext = false;
        var intendUntil=0;
        cards.each((cardIndex, card)=> {
            if(intendUntil>-1) intendUntil--;
            if(intendUntil===0 && intend>0) intend--;
            console.log('intendUntil: ' + intendUntil);
            if(intend<0) intend = 0;
            if($(card).find('.card__content-text small').text()=='Flow Director') {
                var title = $(card).find('.card__content-text').text().trim().substr(13).trim();
                if(title.startsWith('IF the next')) {
                   intendNext = 1;
                   intendUntil = 2;
                   $(card).find('.card__content-text .arg-number').each((numIndex, num)=> {
                       intendUntil += Number.parseInt($(num).text());
                   });
               }
               else if(title.startsWith('IF ')) intendNext = 1;
               else if(title.startsWith('END IF')) intendNext = -1;
            }
            if(intend) $(card).css('margin-left', (intend*15).toString() + 'px');
            if(intendNext) intend +=intendNext;
            intendNext = false;
        });
        
    }, 1000);
</script>