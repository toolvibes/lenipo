from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.announcement import Announcement
from ...models.announcement_input import AnnouncementInput
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    *,
    body: AnnouncementInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/provider/notice",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Announcement | Problem:
    if response.status_code == 200:
        response_200 = Announcement.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Announcement | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: AnnouncementInput,

) -> Response[Announcement | Problem]:
    """ Set the notice of the provider

     For providers, with `Authorization: Bearer <SETUP_TOKEN>`: a banner for everyone, e.g. planned
    maintenance, shown between `startsAt` and `endsAt` and apart from the administrators' banner. Empty
    text removes it.

    Args:
        body (AnnouncementInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Announcement | Problem]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: AnnouncementInput,

) -> Announcement | Problem | None:
    """ Set the notice of the provider

     For providers, with `Authorization: Bearer <SETUP_TOKEN>`: a banner for everyone, e.g. planned
    maintenance, shown between `startsAt` and `endsAt` and apart from the administrators' banner. Empty
    text removes it.

    Args:
        body (AnnouncementInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Announcement | Problem
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: AnnouncementInput,

) -> Response[Announcement | Problem]:
    """ Set the notice of the provider

     For providers, with `Authorization: Bearer <SETUP_TOKEN>`: a banner for everyone, e.g. planned
    maintenance, shown between `startsAt` and `endsAt` and apart from the administrators' banner. Empty
    text removes it.

    Args:
        body (AnnouncementInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Announcement | Problem]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: AnnouncementInput,

) -> Announcement | Problem | None:
    """ Set the notice of the provider

     For providers, with `Authorization: Bearer <SETUP_TOKEN>`: a banner for everyone, e.g. planned
    maintenance, shown between `startsAt` and `endsAt` and apart from the administrators' banner. Empty
    text removes it.

    Args:
        body (AnnouncementInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Announcement | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
