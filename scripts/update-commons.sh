#!/bin/bash

cd .. 

services=("auth" "expiration" "orders" "payments" "tickets") 
commonsLibrary="@monkeytickets/common" 

for service in "${services[@]}"; do
  echo "Updating $commonsLibrary in $service..."
  
  cd "$service" || continue
  
  npm install "$commonsLibrary@latest" --save

  cd ..
  
  echo "$commonsLibrary updated in $service."
done

echo "All services have been updated."
