#!/bin/bash

# Default topic
default_topic="calendar-337667"

# Prompt for topic, title, and body
read -p "Enter topic (default: $default_topic): " topic
read -p "Enter title: (default: Invasion of the Coffee Snatchers!)" title
read -p "Enter body: (default: Alert! A group of highly caffeinated...)" body

# Use default topic if no input is provided
topic=${topic:-$default_topic}
title=${title:-"Invasion of the Coffee Snatchers!"}
body=${body:-"Alert! A group of highly caffeinated squirrels has been spotted at the office coffee machine, plotting to steal all the coffee beans. Employees are advised to guard their cups with their lives and bribe the intruders with nuts to reclaim their caffeine rights."}

# URL encode the parameters
# Note: This encoding function handles basic encoding, but might not cover all special characters.
urlencode() {
    local length="${#1}"
    for (( i = 0; i < length; i++ )); do
        local c="${1:i:1}"
        case $c in
            [a-zA-Z0-9.~_-]) printf "$c" ;;
            *) printf '%%%02X' "'$c" ;;
        esac
    done
}

# URL encode the inputs
encoded_topic=$(urlencode "$topic")
encoded_title=$(urlencode "$title")
encoded_body=$(urlencode "$body")

# Send the request
curl -X POST "https://notifications-api-7ioginpu3a-lz.a.run.app/trigger?topic=$encoded_topic&title=$encoded_title&body=$encoded_body"
