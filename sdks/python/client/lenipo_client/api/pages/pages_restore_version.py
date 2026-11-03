from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.restore_version_request import RestoreVersionRequest
from typing import cast



def _get_kwargs(
    id: str,
    number: str,
    *,
    body: RestoreVersionRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/pages/{id}/versions/{number}/restore".format(id=quote(str(id), safe=""),number=quote(str(number), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem:
    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    number: str,
    *,
    client: AuthenticatedClient | Client,
    body: RestoreVersionRequest,

) -> Response[Problem]:
    """ Restore an older version

     Publishes the content and title of the version again as the newest version; the live draft follows,
    also in open editors. Requires the space permission `edit`.

    Args:
        id (str):
        number (str):
        body (RestoreVersionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem]
     """


    kwargs = _get_kwargs(
        id=id,
number=number,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    number: str,
    *,
    client: AuthenticatedClient | Client,
    body: RestoreVersionRequest,

) -> Problem | None:
    """ Restore an older version

     Publishes the content and title of the version again as the newest version; the live draft follows,
    also in open editors. Requires the space permission `edit`.

    Args:
        id (str):
        number (str):
        body (RestoreVersionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem
     """


    return sync_detailed(
        id=id,
number=number,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: str,
    number: str,
    *,
    client: AuthenticatedClient | Client,
    body: RestoreVersionRequest,

) -> Response[Problem]:
    """ Restore an older version

     Publishes the content and title of the version again as the newest version; the live draft follows,
    also in open editors. Requires the space permission `edit`.

    Args:
        id (str):
        number (str):
        body (RestoreVersionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem]
     """


    kwargs = _get_kwargs(
        id=id,
number=number,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    number: str,
    *,
    client: AuthenticatedClient | Client,
    body: RestoreVersionRequest,

) -> Problem | None:
    """ Restore an older version

     Publishes the content and title of the version again as the newest version; the live draft follows,
    also in open editors. Requires the space permission `edit`.

    Args:
        id (str):
        number (str):
        body (RestoreVersionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem
     """


    return (await asyncio_detailed(
        id=id,
number=number,
client=client,
body=body,

    )).parsed
