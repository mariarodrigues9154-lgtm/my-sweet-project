import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CircleEllipsis, Heart, MessageCircle, MoreVertical, MapPin, Truck, CreditCard, Star, ShoppingCart, Share2, Clock3, CheckCircle2 } from "lucide-react";

const productImages = [
  "https://img.olx.com.br/images/90/908555479293515.jpg",
  "https://www.disbamoveis.com.br/image/cache/catalog/caixa-de-som/zaiwa-t2w-02/aiwa-t2w2-800x800.jpg",
  "https://americanas.vtexassets.com/arquivos/ids/36273041-768-auto/Caixa-De-Som-Aiwa-Torre-Bluetooth-2300w-Aws-t2w-02-Preto-Bivolt.webp?quality=9&v=638920439420270000",
  "https://aiwa.vtexassets.com/arquivos/ids/156814/AWS-T2W-02---Foto-03.jpg?v=638936259812300000",
];

const reviews = [
  ["Roberto Almeida","São Paulo SP","Caixa de som fantástica! O som é muito potente e o grave enche a sala inteira. Liguei na tomada e pareou no Bluetooth de primeira.","287"],
  ["Patricia Santos","Rio de Janeiro RJ","Comprei pra usar na sala e foi a melhor decisão! O bivolt automático facilitou, liguei direto sem transformador. Grave muito bom, recomendo demais!","221"],
  ["André Costa","Goiânia GO","Comprei pra colocar na área da churrasqueira. Todo mundo que vem aqui elogia o som. Vale cada centavo!","134"],
  ["Patricia Alves","Florianópolis SC","Muito leve para transportar e ao mesmo tempo robusta. O bivolt automático é uma mão na roda, ligo em qualquer tomada.","201"],
  ["Ricardo Mendes","Campinas SP","Excelente custo benefício. A potência de 2300W atende muito bem um espaço grande com várias pessoas.","167"],
  ["Juliana Pereira","Santos SP","Design moderno, som cristalino e acabamento impecável. Produto de altíssima qualidade!","245"],
  ["Marcos Oliveira","Niterói RJ","O pareamento bluetooth é quase instantâneo. Bateria e alimentação funcionam perfeitamente. Recomendo com certeza.","112"],
];

function ProductPage(){
  const [image,setImage]=useState(0);
  const [liked,setLiked]=useState(false);
  const [seconds,setSeconds]=useState(19*60+54);

  useEffect(()=>{const id=setInterval(()=>setSeconds(s=>s>0?s-1:19*60+54),1000);return()=>clearInterval(id)},[]);
  const mm=String(Math.floor(seconds/60)).padStart(2,"0"), ss=String(seconds%60).padStart(2,"0");

  return <div className="deal-page">
    <div className="deal-top">
      <div className="gallery">
        <button className="round back"><ChevronLeft size={22}/></button>
        <img className="main-product-image" src={productImages[image]} alt="Caixa de Som Torre Bluetooth Aiwa AWS-T2W-02"/>
        <div className="gallery-overlay">
          <div className="hero-copy"><b>DUPLA LUZ<br/>STROBO</b><span>Tenha efeitos luminosos<br/>vibrantes e anime sua festa!</span></div>
          <div className="hero-copy bottom"><b>RGB-LED<br/>COLOR<br/>LIGHTS</b><span>8 modos de luzes dinâmicas<br/>com efeitos multicoloridos</span></div>
        </div>
        <div className="gallery-actions"><button className="round"><MessageCircle size={20}/></button><button className="round"><Share2 size={19}/></button><button className="round"><ShoppingCart size={20}/><i>0</i></button><button className="round"><MoreVertical size={20}/></button></div>
        <span className="counter">{image+1}/4</span>
      </div>
      <div className="thumbs">{productImages.map((src,i)=><button key={src} className={i===image?"active":""} onClick={()=>setImage(i)}><img src={src} alt=""/></button>)}</div>
    </div>

    <div className="flash"><strong>OFERTAS RELÂMPAGO</strong><span>TERMINA EM</span><b>{mm} : {ss}</b></div>
    <section className="price-box">
      <div className="price-row"><div><strong>R$57,90</strong> <del>R$1.329,00</del> <em>-96%</em><p>Em até <b>12x de R$5,79</b> sem juros</p></div><button onClick={()=>setLiked(!liked)} className={liked?"heart active":"heart"}><Heart size={23} fill={liked?"currentColor":"none"}/></button></div>
      <div className="sold">+57,3mil Vendido(s)</div>
      <h1><mark>INDICADO</mark> Caixa de Som Torre Bluetooth 2300W AWS-T2W-02 Bivolt</h1>
    </section>

    <div className="benefits">
      <div><Truck/><span><b>Frete grátis</b> <del>R$29,90</del> <strong>R$0,00 com cupom</strong></span><ChevronRight/></div>
      <div><CreditCard/><span><b>SParcelado:</b> Parcele em até <strong>12x</strong></span><ChevronRight/></div>
      <div className="rank"><Star fill="currentColor"/><span>No. 1 Mais Vendidos em Caixas de Som e Áudio</span><ChevronRight/></div>
    </div>

    <section className="shipping">
      <div><Truck/><span><b>FRETE GRÁTIS</b> — A maioria recebe em até 4 dias<small>Comprando dentro das próximas 20:00:00</small></span></div>
      <div><MapPin/><span><b>Envio imediato</b> — estoque oficial Loja Áudio Som<small>Receba com código de rastreio em tempo real</small></span></div>
    </section>

    <section className="reviews">
      <div className="review-head"><div><strong>4.9</strong><span>★</span> <b>Avaliações do produto</b> <a>(+300)</a></div><button>Ver mais <ChevronRight size={15}/></button></div>
      <div className="tags"><span>Ótima qualidade (312)</span><span>Som potente e limpo (245)</span><span>Entrega rápida (198)</span></div>
      {reviews.map(([name,city,text,help],i)=><article className="review" key={name}><div className="avatar">{name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div className="review-body"><div className="review-name">{name} - {city}</div><div className="stars">★★★★★</div><p>{text}</p>{i<2 && <img src={i===0?productImages[1]:productImages[0]} alt="Foto enviada por cliente"/>}<footer><span>Há {i+1} dias</span><span>♧ Útil ({help})</span></footer></div></article>)}
      <div className="pages"><button>1</button><button>2</button><button className="current">3</button><span>...</span><button disabled>12</button></div>
    </section>

    <section className="seller">
      <div className="seller-top"><div className="store-avatar">A</div><div><b>Loja Oficial Áudio & Som</b><span>● Online</span></div><button>Ver loja</button></div>
      <div className="seller-stats"><div><b>4.9</b><span>Avaliação</span></div><div><b>987</b><span>Vendidos</span></div><div><b>100%</b><span>Recomendado</span></div></div>
    </section>

    <section className="spec">
      <h2>Especificação</h2>
      {[
        ["Marca","AWS"],["Modelo","AWS-T2W-02"],["Potência","2300W PMPO"],["Conexão","Bluetooth 5.0"],["Entradas","USB, cartão SD, P2 auxiliar, rádio FM"],["Microfone","Entrada para karaokê"],["Iluminação","LED sincronizada com a música"],["Tensão","Bivolt automático (110V/220V)"],["Controle remoto","Incluso"],["Tipo de produto","Caixa de Som Torre Bluetooth"]
      ].map(([a,b])=><div className="spec-row" key={a}><span>{a}</span><b>{b}</b></div>)}
    </section>

    <section className="description">
      <h2>Descrição</h2>
      <b>Caixa de Som Torre Bluetooth 2300W AWS-T2W-02 Bivolt</b>
      <p>Som potente de verdade para sua casa, festa ou churrasco. A torre AWS-T2W-02 entrega 2300W de potência (PMPO) com graves profundos, iluminação LED e conexão Bluetooth instantânea.</p>
      <p>✨ <b>Destaques do Produto:</b></p>
      <p>• Bluetooth 5.0 com pareamento rápido<br/>• Dupla luz strobo e RGB LED<br/>• Entradas USB, auxiliar, cartão SD e microfone<br/>• Bivolt automático<br/>• Controle remoto incluso</p>
      <p>Garantia: <b>7 dias para troca e devolução + garantia do fabricante.</b></p>
      <img className="description-img" src={productImages[2]} alt="Aiwa AWS-T2W-02"/>
      <img className="description-img" src={productImages[0]} alt="Aiwa AWS-T2W-02"/>
    </section>

    <div className="buybar"><button><MessageCircle/></button><button><ShoppingCart/></button><button>Compre agora</button></div>
  </div>
}

export { ProductPage };
export const routeProductComponent = ProductPage;