from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.comment import Comment
from ...models.issues_comments_format import IssuesCommentsFormat
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    key: str,
    *,
    format_: IssuesCommentsFormat | Unset = IssuesCommentsFormat.JSON,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/issues/{key}/comments".format(key=quote(str(key), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | list[Comment]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in (_response_200):
            response_200_item = Comment.from_dict(response_200_item_data)



            response_200.append(response_200_item)

        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | list[Comment]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    format_: IssuesCommentsFormat | Unset = IssuesCommentsFormat.JSON,

) -> Response[Problem | list[Comment]]:
    """ List the comments of an issue

    Args:
        key (str):
        format_ (IssuesCommentsFormat | Unset):  Default: IssuesCommentsFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[Comment]]
     """


    kwargs = _get_kwargs(
        key=key,
format_=format_,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    format_: IssuesCommentsFormat | Unset = IssuesCommentsFormat.JSON,

) -> Problem | list[Comment] | None:
    """ List the comments of an issue

    Args:
        key (str):
        format_ (IssuesCommentsFormat | Unset):  Default: IssuesCommentsFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[Comment]
     """


    return sync_detailed(
        key=key,
client=client,
format_=format_,

    ).parsed

async def asyncio_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    format_: IssuesCommentsFormat | Unset = IssuesCommentsFormat.JSON,

) -> Response[Problem | list[Comment]]:
    """ List the comments of an issue

    Args:
        key (str):
        format_ (IssuesCommentsFormat | Unset):  Default: IssuesCommentsFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[Comment]]
     """


    kwargs = _get_kwargs(
        key=key,
format_=format_,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    format_: IssuesCommentsFormat | Unset = IssuesCommentsFormat.JSON,

) -> Problem | list[Comment] | None:
    """ List the comments of an issue

    Args:
        key (str):
        format_ (IssuesCommentsFormat | Unset):  Default: IssuesCommentsFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[Comment]
     """


    return (await asyncio_detailed(
        key=key,
client=client,
format_=format_,

    )).parsed
