drop index if exists chunks_embedding_idx;
alter table chunks alter column embedding type vector(1024);
create index on chunks using hnsw (embedding vector_cosine_ops);