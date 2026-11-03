from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.notification_category import NotificationCategory
from ...models.notification_list import NotificationList
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    unread: str | Unset = UNSET,
    category: NotificationCategory | Unset = UNSET,
    limit: int | Unset = 30,
    before: int | Unset = UNSET,
    after: int | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["unread"] = unread

    json_category: str | Unset = UNSET
    if not isinstance(category, Unset):
        json_category = category.value

    params["category"] = json_category

    params["limit"] = limit

    params["before"] = before

    params["after"] = after


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/me/notifications",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> NotificationList | Problem:
    if response.status_code == 200:
        response_200 = NotificationList.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[NotificationList | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    unread: str | Unset = UNSET,
    category: NotificationCategory | Unset = UNSET,
    limit: int | Unset = 30,
    before: int | Unset = UNSET,
    after: int | Unset = UNSET,

) -> Response[NotificationList | Problem]:
    """ List the caller’s notifications, newest first

    Args:
        unread (str | Unset):
        category (NotificationCategory | Unset):
        limit (int | Unset):  Default: 30.
        before (int | Unset):
        after (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[NotificationList | Problem]
     """


    kwargs = _get_kwargs(
        unread=unread,
category=category,
limit=limit,
before=before,
after=after,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    unread: str | Unset = UNSET,
    category: NotificationCategory | Unset = UNSET,
    limit: int | Unset = 30,
    before: int | Unset = UNSET,
    after: int | Unset = UNSET,

) -> NotificationList | Problem | None:
    """ List the caller’s notifications, newest first

    Args:
        unread (str | Unset):
        category (NotificationCategory | Unset):
        limit (int | Unset):  Default: 30.
        before (int | Unset):
        after (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        NotificationList | Problem
     """


    return sync_detailed(
        client=client,
unread=unread,
category=category,
limit=limit,
before=before,
after=after,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    unread: str | Unset = UNSET,
    category: NotificationCategory | Unset = UNSET,
    limit: int | Unset = 30,
    before: int | Unset = UNSET,
    after: int | Unset = UNSET,

) -> Response[NotificationList | Problem]:
    """ List the caller’s notifications, newest first

    Args:
        unread (str | Unset):
        category (NotificationCategory | Unset):
        limit (int | Unset):  Default: 30.
        before (int | Unset):
        after (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[NotificationList | Problem]
     """


    kwargs = _get_kwargs(
        unread=unread,
category=category,
limit=limit,
before=before,
after=after,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    unread: str | Unset = UNSET,
    category: NotificationCategory | Unset = UNSET,
    limit: int | Unset = 30,
    before: int | Unset = UNSET,
    after: int | Unset = UNSET,

) -> NotificationList | Problem | None:
    """ List the caller’s notifications, newest first

    Args:
        unread (str | Unset):
        category (NotificationCategory | Unset):
        limit (int | Unset):  Default: 30.
        before (int | Unset):
        after (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        NotificationList | Problem
     """


    return (await asyncio_detailed(
        client=client,
unread=unread,
category=category,
limit=limit,
before=before,
after=after,

    )).parsed
