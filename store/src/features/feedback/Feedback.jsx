import { useConfirmDialog } from "../../components/common/ConfirmDialog";
import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TbStar, TbStarFilled, TbMessageCircle, TbTrash } from "react-icons/tb";
import { request, errorMessage } from "../../services/api";
import { useStore } from "../../application/providers/StoreProvider";


const date = value => new Date(value).toLocaleDateString("en-BD", { dateStyle: "medium" });
function Stars({ value }) {
  return <span className="feedback-stars" aria-label={`${value} out of 5 stars`}>{[1, 2, 3, 4, 5].map(n => n <= value ? <TbStarFilled key={n} aria-hidden="true" /> : <TbStar key={n} aria-hidden="true" />)}</span>;
}
function ErrorText({ error }) { return error ? <p className="error" role="alert">{errorMessage(error)}</p> : null; }

export function ReviewForm({ order, item, trackingToken }) {
  const { storeSlug } = useStore();
  const cache = useQueryClient();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [fileError, setFileError] = useState("");
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);
  const mutation = useMutation({
    mutationFn: () => {
      const body = new FormData();
      body.set("rating", rating); body.set("text", text);
      files.forEach(file => body.append("images", file));
      return request("post", `/feedback/store/${storeSlug}/orders/${order._id}/products/${item.productId}/reviews`, body, { headers: { "X-Tracking-Token": trackingToken }, timeout: 360000 });
    },
    onSuccess: () => {
      setFiles([]);
      cache.invalidateQueries({ queryKey: ["guestOrder", storeSlug, order._id] });
      cache.invalidateQueries({ queryKey: ["feedback", storeSlug, item.productId] });
    },
  });
  const existing = order.reviews?.find(review => review.productId === item.productId);
  if (existing?.deletedAt) return <article className="feedback-entry"><h3>{item.name}</h3><p>This review was removed by the store.</p></article>;
  if (existing || mutation.isSuccess) return <article className="feedback-entry"><h3>{item.name}</h3><p role="status">Thank you — your review has been published.</p>{existing && <><Stars value={existing.rating} /><p>{existing.text}</p></>}</article>;
  return <form className="feedback-form" onSubmit={event => { event.preventDefault(); if (rating && !mutation.isPending) mutation.mutate(); }}>
    <h3>{item.name}</h3>
    <fieldset disabled={mutation.isPending}><legend>Your rating</legend><div className="feedback-rating">{[1, 2, 3, 4, 5].map(n => <label key={n}><input type="radio" name={`rating-${item.productId}`} required value={n} checked={rating === n} onChange={() => setRating(n)} /><span>{n <= rating ? <TbStarFilled aria-hidden="true" /> : <TbStar aria-hidden="true" />}<span className="feedback-sr">{n} {n === 1 ? "star" : "stars"}</span></span></label>)}</div></fieldset>
    <label>Your review<textarea required minLength={1} maxLength={3000} rows={4} value={text} disabled={mutation.isPending} onChange={e => setText(e.target.value)} placeholder="How was the product you received? Share its quality, fit or your experience." /></label>
    <label>Photos (optional)<small>Up to 6 JPEG, PNG or WebP photos, 5 MB each. Avoid personal details in photos.</small><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={mutation.isPending} onChange={e => {
      const selected = Array.from(e.target.files || []);
      if (selected.length + files.length > 6 || selected.some(file => file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setFileError("Choose up to 6 JPEG, PNG or WebP images, each up to 5 MB."); }
      else { setFiles(current => [...current, ...selected]); setFileError(""); }
      e.target.value = "";
    }} /></label>
    <div className="feedback-photos">{previews.map((url, index) => <div key={url}><img src={url} alt={`Review preview ${index + 1}`} /><button type="button" disabled={mutation.isPending} onClick={() => setFiles(current => current.filter((_, i) => i !== index))} aria-label={`Remove photo ${index + 1}`}>Remove</button></div>)}</div>
    {fileError && <p role="alert" className="error">{fileError}</p>}<ErrorText error={mutation.error} />
    <small>Your order name, review and photos will be public. One review per product in this order.</small>
    <button className="btn-primary" disabled={mutation.isPending || !rating || !text.trim()}>{mutation.isPending ? "Publishing review…" : "Publish review"}</button>
  </form>;
}

export function ProductFeedback({ product }) {
  const { storeSlug } = useStore();
  const [page, setPage] = useState(1);
  const [question, setQuestion] = useState("");
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ["feedback", storeSlug, product._id, page], queryFn: () => request("get", `/feedback/store/${storeSlug}/products/${product._id}?page=${page}`) });
  const mutation = useMutation({ mutationFn: () => request("post", `/feedback/store/${storeSlug}/products/${product._id}/questions`, { text: question }), onSuccess: () => { setQuestion(""); setPage(1); cache.invalidateQueries({ queryKey: ["feedback", storeSlug, product._id] }); } });
  const data = query.data;
  return <div className="product-feedback">
    <section className="feedback-panel" aria-label="Customer reviews"><div className="feedback-heading"><h2>Customer reviews</h2>{!!data?.summary.count && <span><strong>{data.summary.average.toFixed(1)}</strong> / 5 · {data.summary.count} {data.summary.count === 1 ? "review" : "reviews"}</span>}</div>
      <p className="muted">Reviews from verified purchases. Share yours from My orders after delivery.</p>
      {query.isPending && <p role="status">Loading reviews…</p>}<ErrorText error={query.error} />
      {data && !data.summary.count && <p>No reviews yet. Be the first to share your experience after delivery.</p>}
      {data?.reviews.map(review => <article className="feedback-entry" key={review._id}><div className="feedback-meta"><strong>{review.displayName}</strong><span className="feedback-verified">Verified purchase</span><time dateTime={review.createdAt}>{date(review.createdAt)}</time></div><Stars value={review.rating} /><p>{review.text}</p><div className="feedback-photos">{review.images.map((image, i) => <a key={image._id || image.url} href={image.url} target="_blank" rel="noreferrer"><img src={image.url} loading="lazy" alt={`Customer photo ${i + 1} of ${product.name}`} /></a>)}</div></article>)}
    </section>
    <section className="feedback-panel" aria-label="Product questions"><div className="feedback-heading"><h2>Questions & answers</h2><TbMessageCircle aria-hidden="true" /></div><p className="muted">Ask about this product. The store will reply here. Please leave out phone numbers and order details.</p>
      {data && !data.questionCount && <p>No questions yet.</p>}
      {data?.questions.map(item => <article className="feedback-entry" key={item._id}><div className="feedback-meta"><strong>Customer question</strong><time dateTime={item.createdAt}>{date(item.createdAt)}</time></div><p>{item.text}</p>{item.reply ? <div className="feedback-reply"><strong>Store reply</strong><p>{item.reply}</p></div> : <small className="muted">Awaiting a reply from the store</small>}</article>)}
      <form className="feedback-form" onSubmit={e => { e.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}><h3>Ask a question</h3><label>Question<textarea required maxLength={1000} rows={3} value={question} onChange={e => { setQuestion(e.target.value); mutation.reset(); }} placeholder="What would you like to know about this product?" /></label><ErrorText error={mutation.error} />{mutation.isSuccess && <p role="status">Your question was posted. Check here for the store’s reply.</p>}<button className="btn-primary" disabled={mutation.isPending || !question.trim()}>{mutation.isPending ? "Posting…" : "Post question"}</button></form>
    </section>
    {data && Math.max(data.summary.count, data.questionCount) > 10 && <nav className="feedback-pagination" aria-label="Feedback pages"><button className="btn-secondary" disabled={page === 1} onClick={() => setPage(n => n - 1)}>Previous</button><span>Page {page}</span><button className="btn-secondary" disabled={page * 10 >= Math.max(data.summary.count, data.questionCount)} onClick={() => setPage(n => n + 1)}>Next</button></nav>}
  </div>;
}

function ReplyForm({ question, productId }) {
  const [reply, setReply] = useState(question.reply || "");
  const cache = useQueryClient();
  const mutation = useMutation({ mutationFn: () => request("patch", `/feedback/questions/${question._id}`, { reply }), onSuccess: () => cache.invalidateQueries({ queryKey: ["adminQuestions", productId] }) });
  return <article className="feedback-entry"><div className="feedback-meta"><strong>Customer question</strong><time>{date(question.createdAt)}</time></div><p>{question.text}</p><form className="feedback-form" onSubmit={e => { e.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}><label>Public store reply<textarea required maxLength={3000} rows={3} value={reply} onChange={e => { setReply(e.target.value); mutation.reset(); }} /></label><ErrorText error={mutation.error} />{mutation.isSuccess && <p role="status">Reply published.</p>}<button className="btn-primary" disabled={mutation.isPending || !reply.trim()}>{mutation.isPending ? "Saving…" : question.reply ? "Update reply" : "Publish reply"}</button></form></article>;
}
export function AdminProductQuestions({ productId }) {
  const query = useQuery({ queryKey: ["adminQuestions", productId], queryFn: () => request("get", `/feedback/products/${productId}/questions`) });
  return <section className="feedback-panel"><h2>Customer questions</h2><p className="muted">Replies appear on this product’s page.</p>{query.isPending && <p role="status">Loading questions…</p>}<ErrorText error={query.error} />{query.data?.length === 0 && <p>No customer questions yet.</p>}{query.data?.map(question => <ReplyForm key={question._id} question={question} productId={productId} />)}</section>;
}

export function AdminProductReviews({ productId }) {
  const [page, setPage] = useState(1);
  const [cleanupWarning, setCleanupWarning] = useState("");
  const cache = useQueryClient();
  const { confirm, confirmationDialog } = useConfirmDialog();
  const query = useQuery({ queryKey: ["adminReviews", productId, page], queryFn: () => request("get", `/feedback/products/${productId}/reviews?page=${page}`) });
  const mutation = useMutation({
    mutationFn: id => request("delete", `/feedback/reviews/${id}`),
    onSuccess: result => {
      setCleanupWarning(result.photoCleanupPending ? "Review removed. Some photos could not be removed from storage yet." : "");
      cache.invalidateQueries({ queryKey: ["adminReviews", productId] });
      cache.invalidateQueries({ queryKey: ["feedback"] });
      cache.invalidateQueries({ queryKey: ["guestOrder"] });
    },
  });
  const reviews = query.data?.items || [];
  return <section className="feedback-panel" aria-label="Manage customer reviews">
    {confirmationDialog}
    <div className="feedback-heading"><h2>Customer reviews</h2>{query.data && <span>{query.data.total} reviews</span>}</div>
    <p className="muted">Reviews from delivered orders. Remove a specific review from this product’s page.</p>
    {query.isPending && <p role="status">Loading reviews…</p>}
    <ErrorText error={query.error || mutation.error} />
    {cleanupWarning && <p role="status">{cleanupWarning}</p>}
    {mutation.isSuccess && !cleanupWarning && <p role="status">Review deleted.</p>}
    {query.data && !query.data.total && <p>No customer reviews yet.</p>}
    {reviews.map(review => <article className="feedback-entry" key={review._id}>
      <div className="feedback-heading"><div className="feedback-meta"><strong>{review.displayName}</strong><time dateTime={review.createdAt}>{date(review.createdAt)}</time></div>
        <button type="button" className="feedback-delete" disabled={mutation.isPending} aria-label={`Delete review by ${review.displayName}`} onClick={() => confirm({ title: "Delete this review?", message: "This review and its photos will be removed from the product page and its rating average. The customer cannot submit it again for this order item.", confirmLabel: "Delete review", onConfirm: () => mutation.mutate(review._id) })}><TbTrash aria-hidden="true" /> Delete review</button>
      </div>
      <Stars value={review.rating} /><p>{review.text}</p>
      <div className="feedback-photos">{review.images.map((image, i) => <a key={image.url} href={image.url} target="_blank" rel="noreferrer"><img src={image.url} alt={`Review photo ${i + 1}`} loading="lazy" /></a>)}</div>
    </article>)}
    {query.data?.total > 10 && <nav className="feedback-pagination" aria-label="Admin review pages"><button className="btn-secondary" disabled={page === 1} onClick={() => setPage(n => n - 1)}>Previous</button><span>Page {page}</span><button className="btn-secondary" disabled={page * 10 >= query.data.total} onClick={() => setPage(n => n + 1)}>Next</button></nav>}
  </section>;
}
