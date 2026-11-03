from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.development_summary import DevelopmentSummary
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    key: str,
    id: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/projects/{key}/releases/{id}/development".format(key=quote(str(key), safe=""),id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | list[DevelopmentSummary]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in (_response_200):
            response_200_item = DevelopmentSummary.from_dict(response_200_item_data)



            response_200.append(response_200_item)

        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | list[DevelopmentSummary]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[Problem | list[DevelopmentSummary]]:
    """ Pull requests and builds of a release

     Per issue of the version with Git activity: open and merged pull requests, failing builds.

    Args:
        key (str):
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[DevelopmentSummary]]
     """


    kwargs = _get_kwargs(
        key=key,
id=id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Problem | list[DevelopmentSummary] | None:
    """ Pull requests and builds of a release

     Per issue of the version with Git activity: open and merged pull requests, failing builds.

    Args:
        key (str):
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[DevelopmentSummary]
     """


    return sync_detailed(
        key=key,
id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    key: str,
    id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[Problem | list[DevelopmentSummary]]:
    """ Pull requests and builds of a release

     Per issue of the version with Git activity: open and merged pull requests, failing builds.

    Args:
        key (str):
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[DevelopmentSummary]]
     """


    kwargs = _get_kwargs(
        key=key,
id=id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Problem | list[DevelopmentSummary] | None:
    """ Pull requests and builds of a release

     Per issue of the version with Git activity: open and merged pull requests, failing builds.

    Args:
        key (str):
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[DevelopmentSummary]
     """


    return (await asyncio_detailed(
        key=key,
id=id,
client=client,

    )).parsed
