from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_filter_subscription import CreateFilterSubscription
from ...models.filter_subscription import FilterSubscription
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    id: str,
    *,
    body: CreateFilterSubscription,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/filters/{id}/subscriptions".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> FilterSubscription | Problem:
    if response.status_code == 201:
        response_201 = FilterSubscription.from_dict(response.json())



        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[FilterSubscription | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: CreateFilterSubscription,

) -> Response[FilterSubscription | Problem]:
    """ Subscribe to a filter

     Whoever can see the filter gets its results by e-mail at the hour in their time zone: daily, on
    weekdays or once a week. The owner may subscribe a group they belong to; every member then gets only
    what they may see. At most 50 issues are listed.

    Args:
        id (str):
        body (CreateFilterSubscription):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[FilterSubscription | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: CreateFilterSubscription,

) -> FilterSubscription | Problem | None:
    """ Subscribe to a filter

     Whoever can see the filter gets its results by e-mail at the hour in their time zone: daily, on
    weekdays or once a week. The owner may subscribe a group they belong to; every member then gets only
    what they may see. At most 50 issues are listed.

    Args:
        id (str):
        body (CreateFilterSubscription):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        FilterSubscription | Problem
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: CreateFilterSubscription,

) -> Response[FilterSubscription | Problem]:
    """ Subscribe to a filter

     Whoever can see the filter gets its results by e-mail at the hour in their time zone: daily, on
    weekdays or once a week. The owner may subscribe a group they belong to; every member then gets only
    what they may see. At most 50 issues are listed.

    Args:
        id (str):
        body (CreateFilterSubscription):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[FilterSubscription | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: CreateFilterSubscription,

) -> FilterSubscription | Problem | None:
    """ Subscribe to a filter

     Whoever can see the filter gets its results by e-mail at the hour in their time zone: daily, on
    weekdays or once a week. The owner may subscribe a group they belong to; every member then gets only
    what they may see. At most 50 issues are listed.

    Args:
        id (str):
        body (CreateFilterSubscription):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        FilterSubscription | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
