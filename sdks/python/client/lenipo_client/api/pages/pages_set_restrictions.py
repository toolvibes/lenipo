from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.page_restrictions import PageRestrictions
from ...models.problem import Problem
from ...models.set_page_restrictions_request import SetPageRestrictionsRequest
from typing import cast



def _get_kwargs(
    id: str,
    *,
    body: SetPageRestrictionsRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/pages/{id}/restrictions".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> PageRestrictions | Problem:
    if response.status_code == 200:
        response_200 = PageRestrictions.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[PageRestrictions | Problem]:
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
    body: SetPageRestrictionsRequest,

) -> Response[PageRestrictions | Problem]:
    """ Limit who may see and edit the page

     Replaces both lists; empty lists lift the restriction. View lists also cover every page below, edit
    lists only this page. Needs edit on the page; whoever sets a list stays in it (E-95).

    Args:
        id (str):
        body (SetPageRestrictionsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PageRestrictions | Problem]
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
    body: SetPageRestrictionsRequest,

) -> PageRestrictions | Problem | None:
    """ Limit who may see and edit the page

     Replaces both lists; empty lists lift the restriction. View lists also cover every page below, edit
    lists only this page. Needs edit on the page; whoever sets a list stays in it (E-95).

    Args:
        id (str):
        body (SetPageRestrictionsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PageRestrictions | Problem
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
    body: SetPageRestrictionsRequest,

) -> Response[PageRestrictions | Problem]:
    """ Limit who may see and edit the page

     Replaces both lists; empty lists lift the restriction. View lists also cover every page below, edit
    lists only this page. Needs edit on the page; whoever sets a list stays in it (E-95).

    Args:
        id (str):
        body (SetPageRestrictionsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PageRestrictions | Problem]
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
    body: SetPageRestrictionsRequest,

) -> PageRestrictions | Problem | None:
    """ Limit who may see and edit the page

     Replaces both lists; empty lists lift the restriction. View lists also cover every page below, edit
    lists only this page. Needs edit on the page; whoever sets a list stays in it (E-95).

    Args:
        id (str):
        body (SetPageRestrictionsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PageRestrictions | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
