from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.labelled_page import LabelledPage
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    label: str,
    *,
    space: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["space"] = space


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/labels/{label}/pages".format(label=quote(str(label), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | list[LabelledPage]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in (_response_200):
            response_200_item = LabelledPage.from_dict(response_200_item_data)



            response_200.append(response_200_item)

        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | list[LabelledPage]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    label: str,
    *,
    client: AuthenticatedClient | Client,
    space: str | Unset = UNSET,

) -> Response[Problem | list[LabelledPage]]:
    """ List the pages with a label

     In every space the caller can see, or only in `space`; sorted by title.

    Args:
        label (str):
        space (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[LabelledPage]]
     """


    kwargs = _get_kwargs(
        label=label,
space=space,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    label: str,
    *,
    client: AuthenticatedClient | Client,
    space: str | Unset = UNSET,

) -> Problem | list[LabelledPage] | None:
    """ List the pages with a label

     In every space the caller can see, or only in `space`; sorted by title.

    Args:
        label (str):
        space (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[LabelledPage]
     """


    return sync_detailed(
        label=label,
client=client,
space=space,

    ).parsed

async def asyncio_detailed(
    label: str,
    *,
    client: AuthenticatedClient | Client,
    space: str | Unset = UNSET,

) -> Response[Problem | list[LabelledPage]]:
    """ List the pages with a label

     In every space the caller can see, or only in `space`; sorted by title.

    Args:
        label (str):
        space (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[LabelledPage]]
     """


    kwargs = _get_kwargs(
        label=label,
space=space,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    label: str,
    *,
    client: AuthenticatedClient | Client,
    space: str | Unset = UNSET,

) -> Problem | list[LabelledPage] | None:
    """ List the pages with a label

     In every space the caller can see, or only in `space`; sorted by title.

    Args:
        label (str):
        space (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[LabelledPage]
     """


    return (await asyncio_detailed(
        label=label,
client=client,
space=space,

    )).parsed
