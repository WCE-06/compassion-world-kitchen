export type CatalogIdentity = { productId?:string|number;productCode?:string;productName?:string };

function normalized(value:string|number|undefined){return String(value??"").trim().toLocaleLowerCase("ja-JP")}

export function matchCatalogProduct<T extends CatalogIdentity>(product:CatalogIdentity,shared:T[]){
  const productId=normalized(product.productId),productCode=normalized(product.productCode),productName=normalized(product.productName);
  return shared.find(item=>productId&&normalized(item.productId)===productId)
    ??shared.find(item=>productCode&&normalized(item.productCode)===productCode)
    ??shared.find(item=>productName&&normalized(item.productName)===productName);
}
